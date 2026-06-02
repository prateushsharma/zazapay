import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";
import AgentRegistryArtifact from "../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };

const AGENT_REGISTRY = "0x1fb017bd45363c1b525e5a4b638ffdb65df51e59" as const;

async function main() {
  const deployerKey = process.env.PRIVATE_KEY as `0x${string}`;
  const agentAAddr  = process.env.AGENT_A_ADDRESS as `0x${string}`;
  const agentBAddr  = process.env.AGENT_B_ADDRESS as `0x${string}`;

  if (!deployerKey || !agentAAddr || !agentBAddr) {
    throw new Error("Set PRIVATE_KEY, AGENT_A_ADDRESS, AGENT_B_ADDRESS in .env");
  }

  const account = privateKeyToAccount(deployerKey);
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

  for (const [label, addr] of [["AGENT_A", agentAAddr], ["AGENT_B", agentBAddr]] as const) {
    const active = await publicClient.readContract({
      address: AGENT_REGISTRY,
      abi: AgentRegistryArtifact.abi,
      functionName: "isActiveAgent",
      args: [addr],
    }) as boolean;

    if (active) {
      console.log(`${label} (${addr}) already registered, skipping`);
      continue;
    }

    console.log(`Registering ${label} (${addr})...`);
    const hash = await walletClient.writeContract({
      address: AGENT_REGISTRY,
      abi: AgentRegistryArtifact.abi,
      functionName: "registerAgent",
      args: [addr, "executor"],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`${label} registered. tx=${hash}`);
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
