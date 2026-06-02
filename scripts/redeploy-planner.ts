import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";
import PlannerGatewayArtifact from "../artifacts/contracts/core/PlannerGateway.sol/PlannerGateway.json" assert { type: "json" };

const PLATFORM   = "0xaD3101C37F091593fEe7cb471e92b5E9A1205194";
const PIR        = "0x83985c6f5572c527e3247f5640c826649aA300fa";

async function main() {
  const key = process.env.PRIVATE_KEY as `0x${string}`;
  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network"),
  });
  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network"),
  });

  console.log("Compiling...");
  const { execSync } = await import("child_process");
  execSync("npx hardhat compile", { stdio: "inherit" });

  console.log("Deploying PlannerGateway...");
  const hash = await walletClient.deployContract({
    abi: PlannerGatewayArtifact.abi,
    bytecode: PlannerGatewayArtifact.bytecode as `0x${string}`,
    args: [PLATFORM, PIR],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  console.log(`PlannerGateway deployed: ${address}`);
  console.log(`tx: ${hash}`);

  // Fund it
  console.log("Funding PlannerGateway with 40 STT...");
  const fundHash = await walletClient.sendTransaction({
    to: address!,
    value: 40n * 10n ** 18n,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log(`Funded. tx=${fundHash}`);

  // initSubscription
  console.log("Initializing subscription...");
  const INIT_ABI = [{
    inputs: [],
    name: "initSubscription",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  }] as const;

  const subHash = await walletClient.writeContract({
    address: address!,
    abi: INIT_ABI,
    functionName: "initSubscription",
  });
  await publicClient.waitForTransactionReceipt({ hash: subHash });
  console.log(`Subscription initialized. tx=${subHash}`);

  console.log(`\nUpdate agents/shared/contracts.ts PlannerGateway address to: ${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
