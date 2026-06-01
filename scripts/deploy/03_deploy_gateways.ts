import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYMENTS_PATH = path.resolve(__dirname, "../../deployments/testnet.json");
const SOMNIA_AGENTS_PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

interface DeploymentFile {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: string;
  contracts: Record<string, string>;
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const existing: DeploymentFile = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));

  const paymentIntentRegistry = existing.contracts["PaymentIntentRegistry"];
  const agentRegistry = existing.contracts["AgentRegistry"];

  if (!paymentIntentRegistry) throw new Error("PaymentIntentRegistry address missing from deployments");
  if (!agentRegistry) throw new Error("AgentRegistry address missing from deployments");

  const executorQuoteFeedUrl = process.env.EXECUTOR_QUOTE_FEED_URL ?? "";

  const PlannerGateway = await ethers.getContractFactory("PlannerGateway");
  const plannerGateway = await PlannerGateway.deploy(
    SOMNIA_AGENTS_PLATFORM,
    paymentIntentRegistry
  );
  await plannerGateway.waitForDeployment();
  const plannerAddress = await plannerGateway.getAddress();

  const NegotiationGateway = await ethers.getContractFactory("NegotiationGateway");
  const negotiationGateway = await NegotiationGateway.deploy(
    SOMNIA_AGENTS_PLATFORM,
    paymentIntentRegistry,
    agentRegistry,
    executorQuoteFeedUrl
  );
  await negotiationGateway.waitForDeployment();
  const negotiationAddress = await negotiationGateway.getAddress();

  const registry = await ethers.getContractAt(
    ["function setAuthorizedCaller(address _caller) external"],
    paymentIntentRegistry
  );

  const tx1 = await registry.setAuthorizedCaller(plannerAddress);
  await tx1.wait();

  const tx2 = await registry.setAuthorizedCaller(negotiationAddress);
  await tx2.wait();

  const FUND_AMOUNT = ethers.parseEther("40");

  const fundPlanner = await deployer.sendTransaction({ to: plannerAddress, value: FUND_AMOUNT });
  await fundPlanner.wait();

  const fundNegotiation = await deployer.sendTransaction({ to: negotiationAddress, value: FUND_AMOUNT });
  await fundNegotiation.wait();

  const plannerContract = await ethers.getContractAt(
    ["function initSubscription() external"],
    plannerAddress
  );
  const initTx1 = await plannerContract.initSubscription();
  await initTx1.wait();

  const negotiationContract = await ethers.getContractAt(
    ["function initSubscription() external"],
    negotiationAddress
  );
  const initTx2 = await negotiationContract.initSubscription();
  await initTx2.wait();

  const updated: DeploymentFile = {
    ...existing,
    deployedAt: new Date().toISOString(),
    contracts: {
      ...existing.contracts,
      PlannerGateway: plannerAddress,
      NegotiationGateway: negotiationAddress,
    },
  };

  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(updated, null, 2));

  console.log(`PlannerGateway     ${plannerAddress}`);
  console.log(`NegotiationGateway ${negotiationAddress}`);
  console.log(`AuthorizedCaller   PlannerGateway → PaymentIntentRegistry`);
  console.log(`AuthorizedCaller   NegotiationGateway → PaymentIntentRegistry`);
  console.log(`Funded             PlannerGateway 40 STT`);
  console.log(`Funded             NegotiationGateway 40 STT`);
  console.log(`Subscription       PlannerGateway initialized`);
  console.log(`Subscription       NegotiationGateway initialized`);
  console.log(`Deployments written to ${DEPLOYMENTS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
