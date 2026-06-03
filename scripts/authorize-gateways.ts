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

const CALLERS = [
  { addr: "0xc156d8137b8a9b0de18d4001a75e9448e3d3ea6b", label: "PlannerGateway"     },
  { addr: "0xca81fcdf81f991cf5eb8b1ec2b86b864016ae6c0", label: "NegotiationGateway" },
  { addr: "0x454e26a4a621cbf271d03a5c55053c71b846e408", label: "VerifierGateway"    },
  { addr: "0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf", label: "SettlementEngine"   },
] as const;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === attempts - 1) throw err;
      console.log(`[retry ${i+1}/${attempts}] ${label} failed: ${err?.shortMessage ?? err?.message}. Waiting 10s...`);
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

  for (const { addr, label } of CALLERS) {
    console.log(`Authorizing ${label} (${addr})...`);
    const hash = await withRetry(() => walletClient.writeContract({
      address: PIR,
      abi: SET_AUTH_ABI,
      functionName: "setAuthorizedCaller",
      args: [addr as Address, true],
    }), label);
    await withRetry(() => publicClient.waitForTransactionReceipt({ hash }), `receipt-${label}`);
    console.log(`Authorized ${label}. tx=${hash}`);
    await sleep(2000);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
