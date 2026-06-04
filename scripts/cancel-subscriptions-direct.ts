import "dotenv/config";
import { createPublicClient, createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

// Reactivity precompile
const PRECOMPILE = "0x0000000000000000000000000000000000000100" as const;

const UNSUBSCRIBE_ABI = [{
  inputs: [{ name: "id", type: "uint256" }],
  name: "unsubscribe",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

// Subscription IDs for old NegotiationGateways
const SUB_IDS = [
  { id: BigInt("0x438036"), label: "NegotiationGateway-1" },
  { id: BigInt("0x4387fa"), label: "NegotiationGateway-2" },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err: any) {
      if (i === attempts - 1) throw err;
      console.log(`Retry ${i+1}: ${err?.shortMessage ?? err?.message}. Waiting 10s...`);
      await sleep(10000);
    }
  }
  throw new Error("unreachable");
}

async function main() {
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

  console.log(`Deployer: ${account.address}`);

  for (const { id, label } of SUB_IDS) {
    console.log(`Cancelling ${label} subscription ${id}...`);
    try {
      const hash = await withRetry(() => walletClient.writeContract({
        address: PRECOMPILE,
        abi: UNSUBSCRIBE_ABI,
        functionName: "unsubscribe",
        args: [id],
      }));
      await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
      console.log(`Cancelled. tx=${hash}`);
    } catch (err: any) {
      console.log(`Failed ${label}: ${err?.shortMessage ?? err?.message}`);
    }
    await sleep(1000);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
