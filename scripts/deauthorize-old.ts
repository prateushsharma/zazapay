import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const PIR = "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" as Address;

const SET_AUTH_ABI = [{
  inputs: [{ name: "_caller", type: "address" }, { name: "_authorized", type: "bool" }],
  name: "setAuthorizedCaller",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

const OLD: { addr: Address; label: string }[] = [
  { addr: "0xca81fcdf81f991cf5eb8b1ec2b86b864016ae6c0", label: "OldNegotiationGateway-1" },
  { addr: "0x901cc568d53f9e2da6dfa7b1ca5d456568c3a05b", label: "OldNegotiationGateway-2" },
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

  for (const { addr, label } of OLD) {
    console.log(`Deauthorizing ${label} (${addr})...`);
    const hash = await withRetry(() => walletClient.writeContract({
      address: PIR,
      abi: SET_AUTH_ABI,
      functionName: "setAuthorizedCaller",
      args: [addr, false],
    }));
    await withRetry(() => publicClient.waitForTransactionReceipt({ hash }));
    console.log(`Deauthorized. tx=${hash}`);
    await sleep(1000);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
// run separately if needed
