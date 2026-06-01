import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "./chain";

import AgentRegistryArtifact from "../../artifacts/contracts/core/AgentRegistry.sol/AgentRegistry.json" assert { type: "json" };
import SettlementEngineArtifact from "../../artifacts/contracts/core/SettlementEngine.sol/SettlementEngine.json" assert { type: "json" };
import PaymentIntentRegistryArtifact from "../../artifacts/contracts/core/PaymentIntentRegistry.sol/PaymentIntentRegistry.json" assert { type: "json" };

export const CONTRACT_ADDRESSES = {
  AgentRegistry:         "0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a" as Address,
  SettlementEngine:      "0xC162ea31883382131a902C9b3C6C12Af2FdF8C9b" as Address,
  PaymentIntentRegistry: "0x83985c6f5572c527e3247f5640c826649aA300fa" as Address,
  NegotiationGateway:    "0xb9285d501474433c798bfEB9620C92eb6e228B26" as Address,
  VerifierGateway:       "0xc590C74816659fFb96E30120296F426F8f7b52Df" as Address,
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
