import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import { somniaTestnet } from "../agents/shared/chain";
import NegotiationGatewayArtifact from "../artifacts/contracts/core/NegotiationGateway.sol/NegotiationGateway.json" assert { type: "json" };

const PLATFORM      = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" as Address;
const PIR           = "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" as Address;
const AGENT_REG     = "0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7" as Address;
const EXECUTOR_FEED = "https://api.zazapay.io/executor-quotes";

const INIT_ABI = [{
  inputs: [], name: "initSubscription", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

const SET_AUTH_ABI = [{
  inputs: [{ name: "_caller", type: "address" }, { name: "_authorized", type: "bool" }],
  name: "setAuthorizedCaller", outputs: [],
  stateMutability: "nonpayable", type: "function",
}] as const;

function log(msg: string) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err: any) {
      if (i === attempts - 1) throw err;
      log(`[retry ${i+1}] ${label}: ${err?.shortMessage ?? err?.message}. Waiting 10s...`);
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

  log(`Deployer: ${account.address}`);
  execSync("npx hardhat compile", { stdio: "inherit" });

  log("Deploying NegotiationGateway...");
  const hash = await withRetry(() => walletClient.deployContract({
    abi: NegotiationGatewayArtifact.abi,
    bytecode: NegotiationGatewayArtifact.bytecode as `0x${string}`,
    args: [PLATFORM, PIR, AGENT_REG, EXECUTOR_FEED],
  }), "deploy");
  const receipt = await withRetry(() => publicClient.waitForTransactionReceipt({ hash }), "receipt");
  const addr = receipt.contractAddress!;
  log(`NegotiationGateway deployed: ${addr} tx=${hash}`);

  log("Funding with 40 STT...");
  const fh = await withRetry(() => walletClient.sendTransaction({
    to: addr, value: 40n * 10n ** 18n,
  }), "fund");
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: fh }), "fund-receipt");
  log(`Funded. tx=${fh}`);

  log("Initializing subscription...");
  const sh = await withRetry(() => walletClient.writeContract({
    address: addr, abi: INIT_ABI, functionName: "initSubscription",
  }), "initSub");
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: sh }), "sub-receipt");
  log(`Subscription initialized. tx=${sh}`);

  log("Authorizing on PIR...");
  const ah = await withRetry(() => walletClient.writeContract({
    address: PIR, abi: SET_AUTH_ABI,
    functionName: "setAuthorizedCaller", args: [addr, true],
  }), "auth");
  await withRetry(() => publicClient.waitForTransactionReceipt({ hash: ah }), "auth-receipt");
  log(`Authorized on PIR. tx=${ah}`);

  log(`\n==> NegotiationGateway: ${addr}`);
  log("Update agents/shared/contracts.ts and deployments/testnet.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
