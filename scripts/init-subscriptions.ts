import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const INIT_SUB_ABI = [
  {
    inputs: [],
    name: "initSubscription",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const GATEWAYS = [
  { name: "PlannerGateway",     address: "0xD6eFDBE5776773eFDF46ba6c4e731A77b877421a" },
  { name: "NegotiationGateway", address: "0xb9285d501474433c798bfEB9620C92eb6e228B26" },
  { name: "VerifierGateway",    address: "0xc590C74816659fFb96E30120296F426F8f7b52Df" },
] as const;

async function main() {
  const key = process.env.PRIVATE_KEY as `0x${string}`;
  if (!key) throw new Error("PRIVATE_KEY not set");

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

  for (const gateway of GATEWAYS) {
    try {
      console.log(`\nCalling initSubscription on ${gateway.name} (${gateway.address})...`);
      const hash = await walletClient.writeContract({
        address: gateway.address,
        abi: INIT_SUB_ABI,
        functionName: "initSubscription",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`${gateway.name} subscription initialized. tx=${hash}`);
    } catch (err: any) {
      console.error(`${gateway.name} failed: ${err?.shortMessage ?? err?.message}`);
    }
  }

  console.log("\nDone. Create a new payment intent to trigger the full flow.");
}

main().catch((e) => { console.error(e); process.exit(1); });
