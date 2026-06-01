import { Request, Response, NextFunction } from "express";
import { isAddress, parseUnits } from "viem";

export interface RecipientInput {
  role: string;
  address: string;
  bps: number;
}

export interface PolicyInput {
  requireAgentPlanning: boolean;
  requireAgentVerification: boolean;
  allowExecutorNegotiation: boolean;
  deadlineSeconds: number;
}

export interface CreateIntentBody {
  amount: string;
  token: string;
  payer: string;
  context?: string;
  recipients: RecipientInput[];
  policy: PolicyInput;
}

const SUPPORTED_TOKENS = [
  "0x286f0E199804F1d2F4936A327590f9AECb262086", // MockERC20
  "STT",
];

export function validateCreateIntent(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as CreateIntentBody;
  const errors: string[] = [];

  if (!body.amount || isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    errors.push("amount must be a positive number");
  }

  if (!body.token) {
    errors.push("token is required");
  } else {
    const tokenNorm = body.token.toLowerCase();
    const supported = SUPPORTED_TOKENS.map((t) => t.toLowerCase());
    if (!supported.includes(tokenNorm)) {
      errors.push(
        `token ${body.token} is not supported. Supported: ${SUPPORTED_TOKENS.join(", ")}`
      );
    }
  }

  // payer is msg.sender on-chain; if provided, validate format
  if (body.payer && !isAddress(body.payer)) {
    errors.push("payer must be a valid Ethereum address if provided");
  }

  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    errors.push("recipients must be a non-empty array");
  } else {
    const totalBps = body.recipients.reduce((sum, r) => sum + (r.bps ?? 0), 0);
    if (totalBps !== 10000) {
      errors.push(`recipients bps must sum to exactly 10000, got ${totalBps}`);
    }
    for (const r of body.recipients) {
      if (!r.address || !isAddress(r.address)) {
        errors.push(`recipient address "${r.address}" is not a valid Ethereum address`);
      }
      if (typeof r.bps !== "number" || r.bps <= 0) {
        errors.push(`recipient bps must be a positive number, got ${r.bps}`);
      }
    }
  }

  if (!body.policy) {
    errors.push("policy is required");
  } else {
    if (typeof body.policy.deadlineSeconds !== "number" || body.policy.deadlineSeconds <= 0) {
      errors.push("policy.deadlineSeconds must be a positive number");
    }
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed", details: errors });
    return;
  }

  next();
}
