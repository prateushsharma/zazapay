import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

const DEPLOYMENTS_PATH = path.join(__dirname, "../../deployments/testnet.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const existing = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));

  const AGENT_PLATFORM   = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
  const INTENT_REGISTRY  = existing.contracts.PaymentIntentRegistry;
  const RECEIPT_REGISTRY = existing.contracts.PaymentReceiptRegistry;
  const SETTLEMENT_ENGINE = existing.contracts.SettlementEngine;
  const AGENT_REGISTRY   = existing.contracts.AgentRegistry;

  console.log("Deploying VerifierGateway...");
  const VerifierGateway = await ethers.getContractFactory("VerifierGateway");
  const verifier = await VerifierGateway.deploy(
    AGENT_PLATFORM,
    INTENT_REGISTRY,
    RECEIPT_REGISTRY,
    SETTLEMENT_ENGINE
  );
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("VerifierGateway deployed:", verifierAddress);

  const agentRegistry = await ethers.getContractAt("AgentRegistry", AGENT_REGISTRY);
  const registerTx = await agentRegistry.registerAgent(verifierAddress, "verifier");
  await registerTx.wait();
  console.log("VerifierGateway registered as active agent");

  const intentRegistry = await ethers.getContractAt("PaymentIntentRegistry", INTENT_REGISTRY);
  const setCallerTx = await intentRegistry.setAuthorizedCaller(verifierAddress);
  await setCallerTx.wait();
  console.log("VerifierGateway set as authorizedCaller on PaymentIntentRegistry");

  const fundTx = await deployer.sendTransaction({
    to: verifierAddress,
    value: ethers.parseEther("40"),
  });
  await fundTx.wait();
  console.log("Funded VerifierGateway with 40 STT");

  const initTx = await verifier.initSubscription();
  await initTx.wait();
  console.log("VerifierGateway subscription initialized");

  existing.contracts.VerifierGateway = verifierAddress;
  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(existing, null, 2));
  console.log("deployments/testnet.json updated");
  console.log("VerifierGateway:", verifierAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
