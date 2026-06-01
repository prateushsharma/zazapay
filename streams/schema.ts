import { SDK } from "@somnia-chain/streams";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";

export const paymentTraceSchema =
  "uint64 timestamp, bytes32 intentId, uint8 eventType, address actor, bytes32 dataHash, string message";

export enum TraceEventType {
  PaymentIntentCreated    = 0,
  SettlementPlanSubmitted = 1,
  ExecutorQuoteSubmitted  = 2,
  ExecutorSelected        = 3,
  PaymentExecuted         = 4,
  PaymentVerified         = 5,
  PaymentFailed           = 6,
  PaymentReceiptCreated   = 7,
}

let _schemaId: `0x${string}` | null = null;

export async function getSchemaId(): Promise<`0x${string}`> {
  if (_schemaId) return _schemaId;
  const key = (process.env.STREAMS_PRIVATE_KEY ?? process.env.PRIVATE_KEY) as `0x${string}`;
  if (!key) throw new Error("STREAMS_PRIVATE_KEY not set");
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
  const sdk = new SDK({ public: publicClient, wallet: walletClient });
  _schemaId = await sdk.streams.computeSchemaId(paymentTraceSchema) as `0x${string}`;
  return _schemaId;
}
