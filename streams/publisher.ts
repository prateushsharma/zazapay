import { SDK, SchemaEncoder, zeroBytes32 } from "@somnia-chain/streams";
import { createPublicClient, createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../agents/shared/chain";
import { paymentTraceSchema, TraceEventType, getSchemaId } from "./schema";

let _sdk: SDK | null = null;
let _schemaRegistered = false;

function initSdk(): SDK {
  if (_sdk) return _sdk;
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
  _sdk = new SDK({ public: publicClient, wallet: walletClient });
  return _sdk;
}

async function ensureSchema(sdk: SDK, schemaId: `0x${string}`): Promise<void> {
  if (_schemaRegistered) return;
  const registered = await sdk.streams.isDataSchemaRegistered(schemaId);
  if (!registered) {
    console.log(`[streams] Registering schema ${schemaId}`);
    const tx = await sdk.streams.registerDataSchemas(
      [{ schemaName: "payment-trace", schema: paymentTraceSchema, parentSchemaId: zeroBytes32 }],
      true
    );
    if (!tx) throw new Error("Schema registration returned null tx");
    const { createPublicClient: cpc, http: h } = await import("viem");
    const pub = cpc({ chain: somniaTestnet, transport: h("https://dream-rpc.somnia.network") });
    const { waitForTransactionReceipt } = await import("viem");
    await waitForTransactionReceipt(pub, { hash: tx as `0x${string}` });
    console.log(`[streams] Schema registered: ${tx}`);
  }
  _schemaRegistered = true;
}

export async function publishTraceEvent(
  intentId: string,
  eventType: TraceEventType,
  actor: string,
  dataHash: string,
  message: string
): Promise<void> {
  const sdk = initSdk();
  const schemaId = await getSchemaId();
  await ensureSchema(sdk, schemaId);

  const encoder = new SchemaEncoder(paymentTraceSchema);
  const ts = BigInt(Math.floor(Date.now() / 1000));
  const intentIdBytes = intentId.startsWith("0x") ? intentId : toHex(intentId, { size: 32 });
  const dataHashBytes = dataHash.startsWith("0x") ? dataHash : toHex(dataHash, { size: 32 });

  const encoded = encoder.encodeData([
    { name: "timestamp", value: ts,              type: "uint64"  },
    { name: "intentId",  value: intentIdBytes,   type: "bytes32" },
    { name: "eventType", value: BigInt(eventType), type: "uint8" },
    { name: "actor",     value: actor,            type: "address" },
    { name: "dataHash",  value: dataHashBytes,    type: "bytes32" },
    { name: "message",   value: message,          type: "string"  },
  ]);

  const dataId = toHex(
    `trace-${intentIdBytes.slice(2, 10)}-${eventType}-${ts}`,
    { size: 32 }
  );

  const tx = await sdk.streams.set([{ id: dataId, schemaId, data: encoded }]);
  console.log(`[streams] Published trace event type=${eventType} intentId=${intentIdBytes} tx=${tx}`);
}
