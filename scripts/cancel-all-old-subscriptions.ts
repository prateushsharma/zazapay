import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const CANCEL_ABI = [{
  inputs: [],
  name: "cancelSubscription",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

const OLD_CONTRACTS: { addr: Address; label: string }[] = [
  { addr: "0xe5b1b390c9c12bcc1c3f4afe60dd70e241c06e01", label: "PlannerGateway-1"     },
  { addr: "0xbd996caf5105110654bc69521a8fd6cc7cfbc057", label: "PlannerGateway-2"     },
  { addr: "0xdab867b2a7051155669321364c34b204c936db39", label: "PlannerGateway-3"     },
  { addr: "0xecdcb76681094ac8e498106d229dccb2aa9a73a7", label: "PlannerGateway-4"     },
  { addr: "0xca81fcdf81f991cf5eb8b1ec2b86b864016ae6c0", label: "NegotiationGateway-1" },
  { addr: "0x901cc568d53f9e2da6dfa7b1ca5d456568c3a05b", label: "NegotiationGateway-2" },
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

  for (const { addr, label } of OLD_CONTRACTS) {
    console.log(`Cancelling ${label} (${addr})...`);
    try {
      const hash = await withRetry(() => walletClient.writeContract({
        address: addr,
        abi: CANCEL_ABI,
        functionName: "cancelSubscription",
      }));
      await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
      console.log(`Cancelled ${label}. tx=${hash}`);
    } catch (err: any) {
      console.log(`Failed ${label}: ${err?.shortMessage ?? err?.message}`);
    }
    await sleep(1000);
  }
  console.log("Done. All old subscriptions cancelled.");
}

main().catch((e) => { console.error(e); process.exit(1); });
