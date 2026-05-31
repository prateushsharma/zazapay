import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "STT");

  const PaymentLib = await ethers.getContractFactory("PaymentLib");
  const paymentLib = await PaymentLib.deploy();
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();
  console.log("PaymentLib:", paymentLibAddress);

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("ZaZaPay Test Token", "ZZP", 18);
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("MockERC20:", mockTokenAddress);

  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log("AgentRegistry:", agentRegistryAddress);

  const PaymentIntentRegistry = await ethers.getContractFactory("PaymentIntentRegistry");
  const paymentIntentRegistry = await PaymentIntentRegistry.deploy();
  await paymentIntentRegistry.waitForDeployment();
  const paymentIntentRegistryAddress = await paymentIntentRegistry.getAddress();
  console.log("PaymentIntentRegistry:", paymentIntentRegistryAddress);

  const deployments = {
    network: "somnia-testnet",
    chainId: 50312,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PaymentLib: paymentLibAddress,
      MockERC20: mockTokenAddress,
      AgentRegistry: agentRegistryAddress,
      PaymentIntentRegistry: paymentIntentRegistryAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentsDir, "testnet.json"),
    JSON.stringify(deployments, null, 2)
  );

  console.log("\nDeployment saved to deployments/testnet.json");
  console.log(JSON.stringify(deployments, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
