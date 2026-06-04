import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const PIR = "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" as Address;

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

const STATUS = ["CREATED","PLANNED","EXECUTOR_SELECTED","EXECUTING","SETTLED","VERIFIED","FAILED","EXPIRED"];

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

async function main() {
  const intentId = process.argv[2] as `0x${string}`;
  const executorAddr = process.argv[3] as Address ?? process.env.AGENT_A_ADDRESS as Address;

  if (!intentId) {
    console.error("Usage: npx tsx scripts/manual-flow.ts <intentId> <executorAddress>");
    process.exit(1);
  }

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

  log(`Intent:   ${intentId}`);
  log(`Executor: ${executorAddr}`);

  const currentStatus = await publicClient.readContract({
    address: PIR, abi: GET_STATUS_ABI, functionName: "getStatus", args: [intentId],
  }) as number;
  log(`Current status: ${STATUS[currentStatus]} (${currentStatus})`);

  if (currentStatus !== 0) {
    log("Intent not in CREATED status — aborting");
    process.exit(1);
  }

  // CREATED → PLANNED
  log("Advancing to PLANNED...");
  const h1 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: UPDATE_STATUS_ABI,
    functionName: "updateStatus", args: [intentId, 1],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h1 }));
  log(`PLANNED. tx=${h1}`);
  await sleep(2000);

  // Set executor
  log(`Setting executor to ${executorAddr}...`);
  const h2 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: SET_EXECUTOR_ABI,
    functionName: "setSelectedExecutor", args: [intentId, executorAddr, 0n],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h2 }));
  log(`Executor set. tx=${h2}`);

  // PLANNED → EXECUTOR_SELECTED
  log("Advancing to EXECUTOR_SELECTED...");
  const h3 = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: UPDATE_STATUS_ABI,
    functionName: "updateStatus", args: [intentId, 2],
  }));
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: h3 }));
  log(`EXECUTOR_SELECTED. tx=${h3}`);
  log(`Watch agent terminals now — Agent A should detect this event.`);

  // Poll for status change
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const s = await publicClient.readContract({
      address: PIR, abi: GET_STATUS_ABI, functionName: "getStatus", args: [intentId],
    }) as number;
    log(`Status: ${STATUS[s]} (${s})`);
    if (s >= 3) break;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
