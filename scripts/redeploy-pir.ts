import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "child_process";
import { somniaTestnet } from "../agents/shared/chain";
import PIRArtifact from "../artifacts/contracts/core/PaymentIntentRegistry.sol/PaymentIntentRegistry.json" assert { type: "json" };
import SettlementEngineArtifact from "../artifacts/contracts/core/SettlementEngine.sol/SettlementEngine.json" assert { type: "json" };

const AGENT_REG     = "0x1fb017bd45363c1b525e5a4b638ffdb65df51e59" as Address;
const RECEIPT_REG   = "0xec7e01574cbcaEcC7cEaDDa6fcA4BA4cfA334503" as Address;
const PLATFORM      = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776" as Address;
const EXECUTOR_FEED = "https://zazapay-executor-feed.onrender.com/quotes";

// Gateway addresses (just redeployed)
const PLANNER     = "0xe5b1b390c9c12bcc1c3f4afe60dd70e241c06e01" as Address;
const NEGOTIATION = "0xffc305a65cf5617c436237f6890abb83168e8405" as Address;
const VERIFIER    = "0x1286829ba0e720d358f3b863c8d752db2642d93f" as Address;
const AGENT_A     = process.env.AGENT_A_ADDRESS as Address;
const AGENT_B     = process.env.AGENT_B_ADDRESS as Address;

const SET_AUTH_ABI = [{
  inputs: [{ name: "_caller", type: "address" }, { name: "_authorized", type: "bool" }],
  name: "setAuthorizedCaller",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

const INIT_ABI = [{
  inputs: [],
  name: "initSubscription",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
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

  log(`Deployer: ${account.address}`);
  execSync("npx hardhat compile", { stdio: "inherit" });

  // Deploy new PIR
  log("Deploying PaymentIntentRegistry...");
  const pirHash = await walletClient.deployContract({
    abi: PIRArtifact.abi,
    bytecode: PIRArtifact.bytecode as `0x${string}`,
    args: [],
  });
  const pirReceipt = await publicClient.waitForTransactionReceipt({ hash: pirHash });
  const pirAddr = pirReceipt.contractAddress!;
  log(`PIR deployed: ${pirAddr} tx=${pirHash}`);

  // Authorize all gateways + settlement engine on PIR
  const callers = [
    { addr: PLANNER,     label: "PlannerGateway"     },
    { addr: NEGOTIATION, label: "NegotiationGateway" },
    { addr: VERIFIER,    label: "VerifierGateway"    },
  ];

  for (const { addr, label } of callers) {
    log(`Authorizing ${label} on PIR...`);
    const h = await walletClient.writeContract({
      address: pirAddr,
      abi: SET_AUTH_ABI,
      functionName: "setAuthorizedCaller",
      args: [addr, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    log(`Authorized ${label}. tx=${h}`);
  }

  // Deploy new SettlementEngine pointing to new PIR
  log("Deploying SettlementEngine...");
  const seHash = await walletClient.deployContract({
    abi: SettlementEngineArtifact.abi,
    bytecode: SettlementEngineArtifact.bytecode as `0x${string}`,
    args: [AGENT_REG, pirAddr],
  });
  const seReceipt = await publicClient.waitForTransactionReceipt({ hash: seHash });
  const seAddr = seReceipt.contractAddress!;
  log(`SettlementEngine deployed: ${seAddr} tx=${seHash}`);

  // Authorize SettlementEngine on PIR
  log("Authorizing SettlementEngine on PIR...");
  const seAuthHash = await walletClient.writeContract({
    address: pirAddr,
    abi: SET_AUTH_ABI,
    functionName: "setAuthorizedCaller",
    args: [seAddr, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: seAuthHash });
  log(`SettlementEngine authorized. tx=${seAuthHash}`);

  log("\n==> New addresses — update everywhere:");
  log(`PaymentIntentRegistry: ${pirAddr}`);
  log(`SettlementEngine:      ${seAddr}`);
  log("\n==> Gateways need redeployment with new PIR address");
  log(`Run: npx tsx scripts/redeploy-planner.ts && npx tsx scripts/redeploy-gateways.ts`);
  log(`After that, re-register agents A and B`);
}

main().catch((e) => { console.error(e); process.exit(1); });
