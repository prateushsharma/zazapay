import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import { somniaTestnet } from "../agents/shared/chain";
import NegotiationGatewayArtifact from "../artifacts/contracts/core/NegotiationGateway.sol/NegotiationGateway.json" assert { type: "json" };
import VerifierGatewayArtifact from "../artifacts/contracts/core/VerifierGateway.sol/VerifierGateway.json" assert { type: "json" };

const PLATFORM        = "0xaD3101C37F091593fEe7cb471e92b5E9A1205194";
const PIR             = "0x83985c6f5572c527e3247f5640c826649aA300fa";
const AGENT_REG       = "0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a";
const SETTLEMENT      = "0xC162ea31883382131a902C9b3C6C12Af2FdF8C9b";
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
