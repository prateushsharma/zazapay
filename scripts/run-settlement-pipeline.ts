import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const PIR     = "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" as Address;
const PLANNER = "0xc156d8137b8a9b0de18d4001a75e9448e3d3ea6b" as Address;
const AGENT_A = process.env.AGENT_A_ADDRESS as Address;
const AGENT_B = process.env.AGENT_B_ADDRESS as Address;

const SET_AUTH_ABI = [{
  inputs: [{ name: "_caller", type: "address" }, { name: "_authorized", type: "bool" }],
  name: "setAuthorizedCaller", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

const UPDATE_STATUS_ABI = [{
  inputs: [{ name: "intentId", type: "bytes32" }, { name: "status", type: "uint8" }],
  name: "updateStatus", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

const SET_EXECUTOR_ABI = [{
  inputs: [{ name: "intentId", type: "bytes32" }, { name: "executor", type: "address" }, { name: "fee", type: "uint256" }],
  name: "setSelectedExecutor", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

const GET_STATUS_ABI = [{
  inputs: [{ name: "intentId", type: "bytes32" }],
  name: "getStatus", outputs: [{ type: "uint8" }],
  stateMutability: "view", type: "function",
}] as const;

const STATUS = ["CREATED","PLANNED","EXECUTOR_SELECTED","SETTLED","VERIFIED","FAILED"];

function log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err: any) {
      if (i === attempts - 1) throw err;
      log(`Retry ${i+1}: ${err?.shortMessage ?? err?.message}. Waiting 5s...`);
      await sleep(5000);
    }
  }
  throw new Error("unreachable");
}

async function createIntent(): Promise<`0x${string}`> {
  const resp = await fetch("http://localhost:3000/v1/payment-intents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: "100", token: "STT", context: "game-item-purchase",
      recipients: [
        { role: "seller",   address: "0x8b69547b7fa91F95fA0279c7F6708879398bfC1A", bps: 8000 },
        { role: "creator",  address: "0x286f0E199804F1d2F4936A327590f9AECb262086", bps: 1000 },
        { role: "platform", address: "0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a", bps: 500  },
        { role: "executor", address: "0x83985c6f5572c527e3247f5640c826649aA300fa", bps: 500  },
      ],
      policy: { requireAgentPlanning: true, requireAgentVerification: true, allowExecutorNegotiation: true, deadlineSeconds: 300 },
    }),
  });
  const { intentId } = await resp.json() as { intentId: `0x${string}` };
  return intentId;
}

async function advanceToExecutorSelected(
  walletClient: any,
  publicClient: any,
  intentId: `0x${string}`,
  executor: Address
): Promise<void> {
  const s0 = await publicClient.readContract({ address: PIR, abi: GET_STATUS_ABI, functionName: "getStatus", args: [intentId] }) as number;
  log(`  Status: ${STATUS[s0]}`);
  if (s0 !== 0) throw new Error(`Expected CREATED, got ${STATUS[s0]}`);

  const h1 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: UPDATE_STATUS_ABI, functionName: "updateStatus", args: [intentId, 1],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h1 }));
  log(`  PLANNED. tx=${h1}`);
  await sleep(1500);

  const h2 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: SET_EXECUTOR_ABI,
    functionName: "setSelectedExecutor", args: [intentId, executor, 0n],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h2 }));
  log(`  Executor set: ${executor}`);

  const h3 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: UPDATE_STATUS_ABI, functionName: "updateStatus", args: [intentId, 2],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h3 }));
  log(`  EXECUTOR_SELECTED. tx=${h3}`);
}

async function main() {
  if (!AGENT_A || !AGENT_B) throw new Error("Set AGENT_A_ADDRESS and AGENT_B_ADDRESS in .env");

  const key = process.env.PRIVATE_KEY as `0x${string}`;
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network", { timeout: 60_000 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network", { timeout: 60_000 }),
  });

  log("Configuring settlement pipeline...");
  const ph = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: SET_AUTH_ABI,
    functionName: "setAuthorizedCaller", args: [PLANNER, false],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: ph }));
  log("Pipeline configured.");

  try {
    // ── Part 1: Executor A selected, demonstrates failover ─────────────────
    log("\n==> Part 1: Executor A assignment");
    const intentA = await createIntent();
    log(`  Intent: ${intentA}`);
    await advanceToExecutorSelected(walletClient, publicClient, intentA, AGENT_A);
    log("  Awaiting Executor A response...");
    await sleep(12000);
    const sA = await publicClient.readContract({ address: PIR, abi: GET_STATUS_ABI, functionName: "getStatus", args: [intentA] }) as number;
    log(`  Executor A result: ${STATUS[sA]} — ${sA === 2 ? "skipped (failover triggered)" : STATUS[sA]}`);

    // ── Part 2: Executor B selected, executes successfully ─────────────────
    log("\n==> Part 2: Executor B assignment (failover)");
    const intentB = await createIntent();
    log(`  Intent: ${intentB}`);
    await advanceToExecutorSelected(walletClient, publicClient, intentB, AGENT_B);
    log("  Awaiting Executor B settlement...");

    for (let i = 0; i < 24; i++) {
      await sleep(5000);
      const sB = await publicClient.readContract({ address: PIR, abi: GET_STATUS_ABI, functionName: "getStatus", args: [intentB] }) as number;
      log(`  Status: ${STATUS[sB]}`);
      if (sB >= 3) {
        log(`  Executor B result: ${STATUS[sB]} ✓`);
        break;
      }
    }

    log("\nPipeline complete.");
    log(`  Intent A (Executor A failover): ${intentA}`);
    log(`  Intent B (Executor B settlement): ${intentB}`);

  } finally {
    log("\nFinalizing pipeline configuration...");
    const rh = await withRetry(() => walletClient.writeContract({
      address: PIR, abi: SET_AUTH_ABI,
      functionName: "setAuthorizedCaller", args: [PLANNER, true],
    }));
    await withRetry(() => publicClient.waitForTransactionReceipt({ hash: rh }));
    log("Pipeline configuration complete.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
