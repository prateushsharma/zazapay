import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import { somniaTestnet } from "../agents/shared/chain";
import AgentRegistryArtifact from "../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };
import NegotiationGatewayArtifact from "../artifacts/contracts/core/NegotiationGateway.sol/NegotiationGateway.json" assert { type: "json" };

const PLATFORM      = "0xaD3101C37F091593fEe7cb471e92b5E9A1205194";
const PIR           = "0x83985c6f5572c527e3247f5640c826649aA300fa";
const EXECUTOR_FEED = "https://zazapay-executor-feed.onrender.com/quotes";

const AGENT_A = process.env.AGENT_A_ADDRESS as Address;
const AGENT_B = process.env.AGENT_B_ADDRESS as Address;

const REGISTER_ABI = [{
  inputs: [{ name: "wallet", type: "address" }, { name: "role", type: "string" }],
  name: "registerAgent",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

const IS_ACTIVE_ABI = [{
  inputs: [{ name: "wallet", type: "address" }],
  name: "isActiveAgent",
  outputs: [{ name: "", type: "bool" }],
  stateMutability: "view",
  type: "function",
}] as const;

const INIT_ABI = [{
  inputs: [],
  name: "initSubscription",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

async function main() {
  if (!AGENT_A || !AGENT_B) throw new Error("Set AGENT_A_ADDRESS and AGENT_B_ADDRESS in .env");

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

  console.log(`Deployer: ${account.address}`);
  execSync("npx hardhat compile", { stdio: "inherit" });

  // Deploy new AgentRegistry
  console.log("\nDeploying AgentRegistry...");
  const arHash = await walletClient.deployContract({
    abi: AgentRegistryArtifact.abi,
    bytecode: AgentRegistryArtifact.bytecode as `0x${string}`,
    args: [],
  });
  const arReceipt = await publicClient.waitForTransactionReceipt({ hash: arHash });
  const agentRegistryAddr = arReceipt.contractAddress!;
  console.log(`AgentRegistry deployed: ${agentRegistryAddr} tx=${arHash}`);

  // Register Agent A and B
  for (const [label, addr] of [["AGENT_A", AGENT_A], ["AGENT_B", AGENT_B]] as const) {
    console.log(`Registering ${label} (${addr})...`);
    const hash = await walletClient.writeContract({
      address: agentRegistryAddr,
      abi: REGISTER_ABI,
      functionName: "registerAgent",
      args: [addr, "executor"],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`${label} registered. tx=${hash}`);
  }

  // Deploy new NegotiationGateway with new AgentRegistry
  console.log("\nDeploying NegotiationGateway...");
  const ngHash = await walletClient.deployContract({
    abi: NegotiationGatewayArtifact.abi,
    bytecode: NegotiationGatewayArtifact.bytecode as `0x${string}`,
    args: [PLATFORM, PIR, agentRegistryAddr, EXECUTOR_FEED],
  });
  const ngReceipt = await publicClient.waitForTransactionReceipt({ hash: ngHash });
  const negAddr = ngReceipt.contractAddress!;
  console.log(`NegotiationGateway deployed: ${negAddr} tx=${ngHash}`);

  console.log("\nFunding NegotiationGateway with 40 STT...");
  const fundHash = await walletClient.sendTransaction({
    to: negAddr,
    value: 40n * 10n ** 18n,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log(`Funded. tx=${fundHash}`);

  console.log("\nInitializing subscription...");
  const subHash = await walletClient.writeContract({
    address: negAddr,
    abi: INIT_ABI,
    functionName: "initSubscription",
  });
  await publicClient.waitForTransactionReceipt({ hash: subHash });
  console.log(`Subscription initialized. tx=${subHash}`);

  console.log("\n==> Update these addresses everywhere:");
  console.log(`AgentRegistry:      ${agentRegistryAddr}`);
  console.log(`NegotiationGateway: ${negAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
