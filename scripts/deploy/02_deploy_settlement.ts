import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYMENTS_PATH = path.join(__dirname, "../../deployments/testnet.json");

interface Deployments {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: string;
  contracts: Record<string, string>;
}

async function readDeployments(): Promise<Deployments> {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    throw new Error("deployments/testnet.json not found.");
  }
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
}

function writeDeployments(data: Deployments): void {
  fs.mkdirSync(path.dirname(DEPLOYMENTS_PATH), { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const deployments = await readDeployments();
  const agentRegistryAddress = deployments.contracts.AgentRegistry;

  if (!agentRegistryAddress) {
    throw new Error("AgentRegistry address missing from deployments.");
  }

  // Redeploy PaymentIntentRegistry with authorizedCaller support
  console.log("\nRedeploying PaymentIntentRegistry...");
  const PaymentIntentRegistry = await ethers.getContractFactory("PaymentIntentRegistry");
  const paymentIntentRegistry = await PaymentIntentRegistry.deploy();
  await paymentIntentRegistry.waitForDeployment();
  const paymentIntentRegistryAddress = await paymentIntentRegistry.getAddress();
  console.log("PaymentIntentRegistry deployed:", paymentIntentRegistryAddress);

  console.log("\nDeploying SettlementEngine...");
  const SettlementEngine = await ethers.getContractFactory("SettlementEngine");
  const settlementEngine = await SettlementEngine.deploy(agentRegistryAddress, paymentIntentRegistryAddress);
  await settlementEngine.waitForDeployment();
  const settlementEngineAddress = await settlementEngine.getAddress();
  console.log("SettlementEngine deployed:", settlementEngineAddress);

  console.log("\nDeploying PaymentReceiptRegistry...");
  const PaymentReceiptRegistry = await ethers.getContractFactory("PaymentReceiptRegistry");
  const receiptRegistry = await PaymentReceiptRegistry.deploy(agentRegistryAddress);
  await receiptRegistry.waitForDeployment();
  const receiptRegistryAddress = await receiptRegistry.getAddress();
  console.log("PaymentReceiptRegistry deployed:", receiptRegistryAddress);

  console.log("\nWiring contracts...");

  const tx1 = await settlementEngine.setReceiptRegistry(receiptRegistryAddress);
  await tx1.wait();
  console.log("SettlementEngine.receiptRegistry set:", receiptRegistryAddress);

  const tx2 = await receiptRegistry.setSettlementEngine(settlementEngineAddress);
  await tx2.wait();
  console.log("PaymentReceiptRegistry.settlementEngine set:", settlementEngineAddress);

  const tx3 = await paymentIntentRegistry.setAuthorizedCaller(settlementEngineAddress);
  await tx3.wait();
  console.log("PaymentIntentRegistry.authorizedCaller set:", settlementEngineAddress);

  deployments.contracts.PaymentIntentRegistry = paymentIntentRegistryAddress;
  deployments.contracts.SettlementEngine = settlementEngineAddress;
  deployments.contracts.PaymentReceiptRegistry = receiptRegistryAddress;

  writeDeployments(deployments);
  console.log("\ndeployments/testnet.json updated.");

  console.log("\n=== Chat 2 Deployment Summary ===");
  console.log("PaymentIntentRegistry:   ", paymentIntentRegistryAddress);
  console.log("SettlementEngine:        ", settlementEngineAddress);
  console.log("PaymentReceiptRegistry:  ", receiptRegistryAddress);
  console.log("=================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
