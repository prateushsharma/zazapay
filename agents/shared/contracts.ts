import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

import AgentRegistryArtifact from "../../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };
import SettlementEngineArtifact from "../../artifacts/contracts/core/SettlementEngine.sol/SettlementEngine.json" assert { type: "json" };
import PaymentIntentRegistryArtifact from "../../artifacts/contracts/core/PaymentIntentRegistry.sol/PaymentIntentRegistry.json" assert { type: "json" };

export const CONTRACT_ADDRESSES = {
  AgentRegistry:         "0x1fb017bd45363c1b525e5a4b638ffdb65df51e59" as Address,
  SettlementEngine:      "0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf" as Address,
  PaymentIntentRegistry: "0xf7b4f680aaddab9247423e1d833e038c760aa1e6" as Address,
  NegotiationGateway:    "0xca81fcdf81f991cf5eb8b1ec2b86b864016ae6c0" as Address,
  VerifierGateway:       "0x454e26a4a621cbf271d03a5c55053c71b846e408" as Address,
} as const;

export const AGENT_REGISTRY_ABI    = AgentRegistryArtifact.abi;
export const SETTLEMENT_ENGINE_ABI = SettlementEngineArtifact.abi;
export const PAYMENT_INTENT_REGISTRY_ABI = PaymentIntentRegistryArtifact.abi;

export function makeClients(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network"),
  });
  const walletClient = createWalletClient({
    account,
    chain: somniaTestnet,
    transport: http("https://dream-rpc.somnia.network"),
  });
  return { account, publicClient, walletClient };
}
