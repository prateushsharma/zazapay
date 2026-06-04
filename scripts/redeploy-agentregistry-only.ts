import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";
import AgentRegistryArtifact from "../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };

const AGENT_A = process.env.AGENT_A_ADDRESS as Address;
const AGENT_B = process.env.AGENT_B_ADDRESS as Address;

const REGISTER_ABI = [{
  inputs: [{ name: "wallet", type: "address" }, { name: "role", type: "string" }],
  name: "registerAgent", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

function log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err: any) {
      if (i === attempts - 1) throw err;
      log(`Retry ${i+1}: ${err?.shortMessage ?? err?.message}. Waiting 10s...`);
      await sleep(10000);
    }
  }
  throw new Error("unreachable");
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

  log(`Deployer: ${account.address}`);

  log("Deploying AgentRegistry...");
  const hash = await withRetry(() => walletClient.deployContract({
    abi: AgentRegistryArtifact.abi,
    bytecode: AgentRegistryArtifact.bytecode as `0x${string}`,
    args: [],
  }));
  const receipt = await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
  const addr = receipt.contractAddress!;
  log(`AgentRegistry deployed: ${addr} tx=${hash}`);

  for (const [label, wallet] of [["AGENT_A", AGENT_A], ["AGENT_B", AGENT_B]] as const) {
    log(`Registering ${label} (${wallet})...`);
    const rh = await withRetry(() => walletClient.writeContract({
      address: addr, abi: REGISTER_ABI,
      functionName: "registerAgent", args: [wallet, "executor"],
    }));
    await withRetry(() => publicClient.waitForTransactionReceipt({ hash: rh }));
    log(`${label} registered. tx=${rh}`);
    await sleep(1000);
  }

  log(`\n==> AgentRegistry: ${addr}`);
  log("Update contracts.ts, deployments/testnet.json, and redeploy NegotiationGateway with new address");
}

main().catch((e) => { console.error(e); process.exit(1); });
