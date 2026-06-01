import { Router, Request, Response } from "express";
import { createPublicClient, http, type Address } from "viem";
import { somniaTestnet } from "../../agents/shared/chain";

const router = Router();

// PaymentReceiptRegistry ABI (minimal — read-only)
const RECEIPT_REGISTRY_ABI = [
  {
    inputs: [{ name: "intentId", type: "bytes32" }],
    name: "getReceipt",
    outputs: [
      {
        components: [
          { name: "intentId",       type: "bytes32" },
          { name: "executor",       type: "address" },
          { name: "verifier",       type: "address" },
          { name: "txHash",         type: "bytes32" },
          { name: "amount",         type: "uint256" },
          { name: "recipientCount", type: "uint256" },
          { name: "verified",       type: "bool"    },
          { name: "timestamp",      type: "uint256" },
          { name: "receiptHash",    type: "bytes32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const RECEIPT_REGISTRY_ADDRESS = (
  process.env.RECEIPT_REGISTRY ?? "0x0000000000000000000000000000000000000000"
) as Address;

// GET /v1/receipts/:id
router.get("/:id", async (req: Request, res: Response) => {
  const ts = new Date().toISOString();
  const intentId = req.params.id as `0x${string}`;

  if (RECEIPT_REGISTRY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    res.status(503).json({
      error: "PaymentReceiptRegistry not yet deployed",
      note: "Set RECEIPT_REGISTRY env var once deployed",
    });
    return;
  }

  try {
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http("https://dream-rpc.somnia.network"),
    });

    const receipt = await publicClient.readContract({
      address: RECEIPT_REGISTRY_ADDRESS,
      abi: RECEIPT_REGISTRY_ABI,
      functionName: "getReceipt",
      args: [intentId],
    }) as any;

    res.json({
      intentId,
      executor:       receipt.executor,
      verifier:       receipt.verifier,
      txHash:         receipt.txHash,
      amount:         receipt.amount.toString(),
      recipientCount: Number(receipt.recipientCount),
      verified:       receipt.verified,
      timestamp:      receipt.timestamp.toString(),
      time:           new Date(Number(receipt.timestamp) * 1000).toISOString(),
      receiptHash:    receipt.receiptHash,
    });
  } catch (err: any) {
    console.error(`[${ts}] [API] getReceipt failed intentId=${intentId}:`, err?.message);
    res.status(404).json({
      error: "Receipt not found",
      detail: err?.message ?? String(err),
    });
  }
});

export default router;
