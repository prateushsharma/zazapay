import "dotenv/config";
import WebSocket from "ws";
import { keccak256, toHex, encodeAbiParameters, parseAbiParameters, type Address } from "viem";
import { validateEnv } from "./shared/setup-env";
import { makeClients, CONTRACT_ADDRESSES, SETTLEMENT_ENGINE_ABI, AGENT_REGISTRY_ABI, PAYMENT_INTENT_REGISTRY_ABI } from "./shared/contracts";
import { publishTraceEvent } from "../streams/publisher";
import { TraceEventType } from "../streams/schema";

validateEnv();

const AGENT_ID = "EXECUTOR-A";
const PRIVATE_KEY = process.env.PRIVATE_KEY_AGENT_A as `0x${string}`;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [${AGENT_ID}] ${msg}`);
}

// Status enum index for EXECUTOR_SELECTED
// PaymentLib.Status: CREATED=0, PLANNED=1, EXECUTOR_SELECTED=2, SETTLED=3, VERIFIED=4, FAILED=5
const STATUS_EXECUTOR_SELECTED = 2n;

// keccak256("StatusUpdated(bytes32,uint8,uint8)") — grep confirms 3-arg variant
// If your StatusUpdated only has 2 args: keccak256("StatusUpdated(bytes32,uint8)")
const STATUS_UPDATED_TOPIC = keccak256(toHex("StatusUpdated(bytes32,uint8)"));

let failedOnce = false;

async function registerIfNeeded(
  publicClient: ReturnType<typeof makeClients>["publicClient"],
  address: Address
): Promise<void> {
  const active = await publicClient.readContract({
    address: CONTRACT_ADDRESSES.AgentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "isActiveAgent",
    args: [address],
  }) as boolean;

  if (!active) {
    throw new Error(
      `Agent ${address} is not registered in AgentRegistry. Run: npx tsx scripts/register-agents.ts`
    );
  }

  log(`Confirmed active in AgentRegistry`);
}

async function executeSettlement(
  walletClient: ReturnType<typeof makeClients>["walletClient"],
  publicClient: ReturnType<typeof makeClients>["publicClient"],
  intentId: `0x${string}`
): Promise<void> {
  log(`Calling SettlementEngine.executeSettlement intentId=${intentId}`);
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESSES.SettlementEngine,
    abi: SETTLEMENT_ENGINE_ABI,
    functionName: "executeSettlement",
    args: [intentId],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log(`Settlement executed. tx=${hash} status=${receipt.status}`);
  await publishTraceEvent(
    intentId,
    TraceEventType.PaymentExecuted,
    walletClient.account!.address,
    hash,
    `Executor A executed settlement`
  );
}

async function main(): Promise<void> {
  const { account, publicClient, walletClient } = makeClients(PRIVATE_KEY);
  log(`Wallet address: ${account.address}`);

  await registerIfNeeded(publicClient, account.address);

  log(`Subscribing to StatusUpdated events on PaymentIntentRegistry via WebSocket`);

  const ws = new WebSocket("wss://api.infra.testnet.somnia.network/ws");

  ws.on("open", () => {
    log(`WebSocket connected`);
    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_subscribe",
        params: [
          "logs",
          {
            address: CONTRACT_ADDRESSES.PaymentIntentRegistry,
            topics: [STATUS_UPDATED_TOPIC],
          },
        ],
      })
    );
  });

  ws.on("message", async (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.id === 1 && msg.result) {
      log(`Subscribed. subscriptionId=${msg.result}`);
      return;
    }

    if (!msg.params?.result) return;

    const logEntry = msg.params.result;
    const topics: string[] = logEntry.topics ?? [];

    if (topics[0]?.toLowerCase() !== STATUS_UPDATED_TOPIC.toLowerCase()) return;

    // Decode intentId from topics[1] (indexed)
    const intentId = topics[1] as `0x${string}`;

    // Decode newStatus from data or topics[2] depending on contract
    // StatusUpdated(bytes32 indexed intentId, uint8 oldStatus, uint8 newStatus)
    // oldStatus and newStatus are NOT indexed → packed in data
    let newStatus: bigint;
    try {
      const decoded = encodeAbiParameters(
        parseAbiParameters("uint8, uint8"),
        [0, 0]
      );
      // Decode data field: 2 uint8 values packed as 2x uint256 in ABI
      const dataHex: `0x${string}` = logEntry.data;
      // Each uint8 is padded to 32 bytes in ABI encoding
      newStatus = BigInt("0x" + dataHex.slice(2, 66)); // only non-indexed field = newStatus
    } catch {
      log(`Failed to decode log data`);
      return;
    }

    if (newStatus !== STATUS_EXECUTOR_SELECTED) return;

    // Check if this agent is the selected executor
    let selectedExecutor: Address;
    try {
      const intent = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.PaymentIntentRegistry,
        abi: PAYMENT_INTENT_REGISTRY_ABI,
        functionName: "getIntent",
        args: [intentId],
      }) as [any, any];
      selectedExecutor = intent[0].selectedExecutor as Address;
    } catch (err) {
      log(`getIntent failed: ${err}`);
      return;
    }

    if (selectedExecutor.toLowerCase() !== account.address.toLowerCase()) {
      log(`Skipping — selectedExecutor=${selectedExecutor} is not this agent`);
      return;
    }

    log(`Selected as executor for intentId=${intentId}`);

    if (!failedOnce) {
      failedOnce = true;
      log(`Intentional failure on first selection (failover demo). Skipping execution.`);
      await publishTraceEvent(
        intentId,
        TraceEventType.PaymentFailed,
        account.address,
        toHex("agent-a-deliberate-skip", { size: 32 }),
        `Executor A deliberate skip (failover demo)`
      );
      return;
    }

    try {
      await executeSettlement(walletClient, publicClient, intentId);
    } catch (err) {
      log(`executeSettlement failed: ${err}`);
      await publishTraceEvent(
        intentId,
        TraceEventType.PaymentFailed,
        account.address,
        toHex("agent-a-tx-failed", { size: 32 }),
        `Executor A tx failed: ${String(err).slice(0, 120)}`
      );
    }
  });

  ws.on("error", (err) => log(`WebSocket error: ${err.message}`));
  ws.on("close", () => {
    log(`WebSocket closed. Reconnecting in 5s...`);
    setTimeout(main, 5000);
  });
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] [${AGENT_ID}] Fatal:`, err);
  process.exit(1);
});
