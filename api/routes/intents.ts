import { Router, Request, Response } from "express";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  keccak256,
  encodePacked,
  toHex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet } from "../../agents/shared/chain";
import {
  CONTRACT_ADDRESSES,
  PAYMENT_INTENT_REGISTRY_ABI,
} from "../../agents/shared/contracts";
import { validateCreateIntent, type CreateIntentBody } from "../middleware/validate";
import { publishTraceEvent } from "../../streams/publisher";
import { TraceEventType } from "../../streams/schema";
import { SDK, SchemaEncoder } from "@somnia-chain/streams";

const router = Router();

const STATUS_LABELS: Record<number, string> = {
  0: "CREATED",
  1: "PLANNED",
  2: "EXECUTOR_SELECTED",
  3: "EXECUTING",
  4: "SETTLED",
  5: "VERIFIED",
  6: "FAILED",
  7: "EXPIRED",
};

function getApiClient() {
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
  return { account, publicClient, walletClient };
}

// POST /v1/payment-intents
router.post("/", validateCreateIntent, async (req: Request, res: Response) => {
  const ts = new Date().toISOString();
  const body = req.body as CreateIntentBody;

  try {
    const { account, publicClient, walletClient } = getApiClient();

    const MOCK_ERC20 = "0x286f0E199804F1d2F4936A327590f9AECb262086" as Address;
    const tokenAddress: Address =
      body.token.toLowerCase() === "stt"
        ? MOCK_ERC20
        : body.token as Address;

    const amountWei = parseUnits(body.amount, 18);
    const deadlineTs = BigInt(Math.floor(Date.now() / 1000) + body.policy.deadlineSeconds);

    const recipients = body.recipients.map((r) => ({
      role: r.role,
      wallet: r.address as Address,
      bps: r.bps,
    }));

    console.log(`[${ts}] [API] Creating intent payer=${body.payer} amount=${body.amount} token=${tokenAddress}`);

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.PaymentIntentRegistry,
      abi: PAYMENT_INTENT_REGISTRY_ABI,
      functionName: "createIntent",
      args: [
        tokenAddress,
        amountWei,
        recipients,
        deadlineTs,
        body.context ?? "",
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract intentId from logs
    let intentId: `0x${string}` = hash; // fallback
    for (const log of receipt.logs) {
      if (log.topics[0]) {
        // PaymentIntentCreated(bytes32 indexed intentId, ...)
        // intentId is topics[1]
        if (log.topics[1]) {
          intentId = log.topics[1] as `0x${string}`;
          break;
        }
      }
    }

    console.log(`[${ts}] [API] Intent created intentId=${intentId} tx=${hash}`);

    await publishTraceEvent(
      intentId,
      TraceEventType.PaymentIntentCreated,
      account.address,
      hash,
      `Payment intent created amount=${body.amount} recipients=${body.recipients.length}`
    );

    res.status(201).json({
      intentId,
      txHash: hash,
      status: "CREATED",
      payer: body.payer,
      token: tokenAddress,
      amount: body.amount,
      recipients: body.recipients,
      deadline: deadlineTs.toString(),
    });
  } catch (err: any) {
    console.error(`[${ts}] [API] createIntent failed:`, err?.shortMessage ?? err?.message ?? err);
    res.status(500).json({
      error: "Failed to create payment intent",
      detail: err?.shortMessage ?? err?.message ?? String(err),
    });
  }
});

// GET /v1/payment-intents/:id
router.get("/:id", async (req: Request, res: Response) => {
  const ts = new Date().toISOString();
  const intentId = req.params.id as `0x${string}`;

  try {
    const { publicClient } = getApiClient();

    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.PaymentIntentRegistry,
      abi: PAYMENT_INTENT_REGISTRY_ABI,
      functionName: "getIntent",
      args: [intentId],
    }) as [any, any[]];

    const intent = result[0];
    const recipients = result[1];

    const statusNum = Number(intent.status);

    res.json({
      intentId,
      payer: intent.payer,
      token: intent.token,
      amount: intent.amount.toString(),
      status: STATUS_LABELS[statusNum] ?? statusNum,
      statusCode: statusNum,
      deadline: intent.deadline.toString(),
      planHash: intent.planHash,
      selectedExecutor: intent.selectedExecutor,
      recipients: recipients.map((r: any) => ({
        address: r.wallet ?? r.recipient ?? r.address,
        bps: Number(r.bps),
        role: r.role,
      })),
    });
  } catch (err: any) {
    console.error(`[${ts}] [API] getIntent failed intentId=${intentId}:`, err?.shortMessage ?? err?.message);
    res.status(404).json({
      error: "Intent not found or RPC error",
      detail: err?.shortMessage ?? err?.message ?? String(err),
    });
  }
});

// GET /v1/payment-intents/:id/trace
router.get("/:id/trace", async (req: Request, res: Response) => {
  const ts = new Date().toISOString();
  const intentId = req.params.id as `0x${string}`;

  try {
    const streamsKey = (process.env.STREAMS_PRIVATE_KEY ?? process.env.PRIVATE_KEY) as `0x${string}`;
    if (!streamsKey) throw new Error("STREAMS_PRIVATE_KEY not set");

    const { getSchemaId } = await import("../../streams/schema");
    const { SDK, SchemaEncoder } = await import("@somnia-chain/streams");
    const { createPublicClient: cpc, createWalletClient: cwc, http: h } = await import("viem");
    const { privateKeyToAccount: pta } = await import("viem/accounts");
    const { paymentTraceSchema, TraceEventType: TET } = await import("../../streams/schema");

    const account = pta(streamsKey);
    const publicClient = cpc({ chain: somniaTestnet, transport: h("https://dream-rpc.somnia.network") });
    const walletClient = cwc({ account, chain: somniaTestnet, transport: h("https://dream-rpc.somnia.network") });
    const sdk = new SDK({ public: publicClient, wallet: walletClient });
    const schemaId = await getSchemaId();

    const allRecords = await sdk.streams.getAllPublisherDataForSchema(schemaId, account.address);
    const encoder = new SchemaEncoder(paymentTraceSchema);

    const traceEvents: any[] = [];

    if (Array.isArray(allRecords)) {
      for (const record of allRecords) {
        try {
          const fields: any[] = Array.isArray(record) ? record : (record as any).data ?? [];
          let recIntentId = "";
          let timestamp = 0n;
          let eventType = 0;
          let actor = "";
          let dataHash = "";
          let message = "";

          for (const field of fields) {
            const val = field.value?.value ?? field.value;
            if (field.name === "intentId") recIntentId = String(val);
            if (field.name === "timestamp") timestamp = BigInt(val);
            if (field.name === "eventType") eventType = Number(val);
            if (field.name === "actor") actor = String(val);
            if (field.name === "dataHash") dataHash = String(val);
            if (field.name === "message") message = String(val);
          }

          const normRecId = recIntentId.toLowerCase().replace(/^0x/, "");
          const normIntentId = intentId.toLowerCase().replace(/^0x/, "");

          if (normRecId === normIntentId || normRecId.startsWith(normIntentId.slice(0, 8))) {
            traceEvents.push({
              timestamp: timestamp.toString(),
              time: new Date(Number(timestamp) * 1000).toISOString(),
              eventType,
              eventName: Object.keys(TET).find((k) => (TET as any)[k] === eventType) ?? String(eventType),
              actor,
              dataHash,
              message,
            });
          }
        } catch {
          // skip malformed records
        }
      }
    }

    traceEvents.sort((a, b) => Number(BigInt(a.timestamp) - BigInt(b.timestamp)));

    res.json({ intentId, traceCount: traceEvents.length, trace: traceEvents });
  } catch (err: any) {
    console.error(`[${ts}] [API] trace failed intentId=${intentId}:`, err?.message);
    res.status(500).json({
      error: "Failed to fetch trace",
      detail: err?.message ?? String(err),
    });
  }
});

export default router;
