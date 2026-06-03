import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import { somniaTestnet } from "../agents/shared/chain";
import NegotiationGatewayArtifact from "../artifacts/contracts/core/NegotiationGateway.sol/NegotiationGateway.json" assert { type: "json" };
import VerifierGatewayArtifact from "../artifacts/contracts/core/VerifierGateway.sol/VerifierGateway.json" assert { type: "json" };

const PLATFORM        = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const PIR             = "0xf7b4f680aaddab9247423e1d833e038c760aa1e6";
const AGENT_REG       = "0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a";
const SETTLEMENT      = "0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf";
const RECEIPT_REG     = "0xec7e01574cbcaEcC7cEaDDa6fcA4BA4cfA334503";
const EXECUTOR_FEED   = "https://zazapay-executor-feed.onrender.com/quotes";

const INIT_ABI = [{
  inputs: [],
  name: "initSubscription",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

async function deployAndInit(
  walletClient: any,
  publicClient: any,
  name: string,
  abi: any,
  bytecode: string,
  args: any[]
): Promise<string> {
  console.log(`\nDeploying ${name}...`);
  const hash = await walletClient.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress!;
  console.log(`${name} deployed: ${address} tx=${hash}`);

  console.log(`Funding ${name} with 40 STT...`);
  const fundHash = await walletClient.sendTransaction({
    to: address,
    value: 40n * 10n ** 18n,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log(`Funded. tx=${fundHash}`);

  console.log(`Initializing subscription for ${name}...`);
  const subHash = await walletClient.writeContract({
    address,
    abi: INIT_ABI,
    functionName: "initSubscription",
  });
  await publicClient.waitForTransactionReceipt({ hash: subHash });
  console.log(`Subscription initialized. tx=${subHash}`);

  return address;
}

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

  console.log(`Deployer: ${account.address}`);
  execSync("npx hardhat compile", { stdio: "inherit" });

  const negAddr = await deployAndInit(
    walletClient, publicClient,
    "NegotiationGateway",
    NegotiationGatewayArtifact.abi,
    NegotiationGatewayArtifact.bytecode,
    [PLATFORM, PIR, AGENT_REG, EXECUTOR_FEED]
  );

  const verAddr = await deployAndInit(
    walletClient, publicClient,
    "VerifierGateway",
    VerifierGatewayArtifact.abi,
    VerifierGatewayArtifact.bytecode,
    [PLATFORM, PIR, RECEIPT_REG, SETTLEMENT]
  );

  console.log("\n==> New addresses — update contracts.ts and .env:");
  console.log(`NegotiationGateway: ${negAddr}`);
  console.log(`VerifierGateway:    ${verAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
