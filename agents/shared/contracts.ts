import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

import AgentRegistryArtifact from "../../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };
import SettlementEngineArtifact from "../../artifacts/contracts/core/SettlementEngine.sol/SettlementEngine.json" assert { type: "json" };
import PaymentIntentRegistryArtifact from "../../artifacts/contracts/core/PaymentIntentRegistry.sol/PaymentIntentRegistry.json" assert { type: "json" };

export const CONTRACT_ADDRESSES = {
  AgentRegistry:         "0x1fb017bd45363c1b525e5a4b638ffdb65df51e59" as Address,
  SettlementEngine:      "0xC162ea31883382131a902C9b3C6C12Af2FdF8C9b" as Address,
  PaymentIntentRegistry: "0x83985c6f5572c527e3247f5640c826649aA300fa" as Address,
  NegotiationGateway:    "0xd521f80411e93ef7bdc537892c34fb2cc76b8988" as Address,
  VerifierGateway:       "0x2a3afbd1e8bbe6e9fedcce518a5e9e8ed00d65c2" as Address,
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
