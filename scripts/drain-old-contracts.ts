import "dotenv/config";
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

const WITHDRAW_ABI = [{
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  name: "withdrawFunds",
  outputs: [],
  stateMutability: "nonpayable",
  type: "function",
}] as const;

// PlannerGateway instances
const PLANNERS = [
  "0xe5b1b390c9c12bcc1c3f4afe60dd70e241c06e01",
  "0xbd996caf5105110654bc69521a8fd6cc7cfbc057",
  "0xdab867b2a7051155669321364c34b204c936db39",
  "0xecdcb76681094ac8e498106d229dccb2aa9a73a7",
] as Address[];

// NegotiationGateway instances
const NEGOTIATIONS = [
  "0x901cc568d53f9e2da6dfa7b1ca5d456568c3a05b",
  "0xca81fcdf81f991cf5eb8b1ec2b86b864016ae6c0",
  "0xffc305a65cf5617c436237f6890abb83168e8405",
  "0x9feb342cddc0d8b7ee0755be39ae70315d95cacf",
  "0x276347f0c4b753e7c5f1188746c721e8704cb156",
] as Address[];

// VerifierGateway has no withdrawFunds — skip
// 0x1286829ba0e720d358f3b863c8d752db2642d93f
// 0x2a3afbd1e8bbe6e9fedcce518a5e9e8ed00d65c2
// 0x71ded1d174bfdfc564ba45d2f0dd198207f789d2

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

  const all = [...PLANNERS, ...NEGOTIATIONS];

  for (const addr of all) {
    const bal = await publicClient.getBalance({ address: addr });
    if (bal === 0n) {
      log(`${addr}: empty, skipping`);
      continue;
    }
    // Leave 0.01 STT for gas
    const amount = bal - 10000000000000000n;
    if (amount <= 0n) {
      log(`${addr}: balance too low to withdraw`);
      continue;
    }
    log(`Withdrawing ${(Number(amount) / 1e18).toFixed(4)} STT from ${addr}...`);
    try {
      const hash = await walletClient.writeContract({
        address: addr,
        abi: WITHDRAW_ABI,
        functionName: "withdrawFunds",
        args: [account.address, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log(`Withdrawn. tx=${hash}`);
    } catch (err: any) {
      log(`Failed ${addr}: ${err?.shortMessage ?? err?.message}`);
    }
  }

  const finalBal = await publicClient.getBalance({ address: account.address });
  log(`Deployer balance after drain: ${(Number(finalBal) / 1e18).toFixed(4)} STT`);
}

main().catch((e) => { console.error(e); process.exit(1); });
