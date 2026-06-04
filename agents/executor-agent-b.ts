import "dotenv/config";
import WebSocket from "ws";
import { keccak256, toHex, type Address } from "viem";
import { validateEnv } from "./shared/setup-env";
import { makeClients, CONTRACT_ADDRESSES, SETTLEMENT_ENGINE_ABI, AGENT_REGISTRY_ABI, PAYMENT_INTENT_REGISTRY_ABI } from "./shared/contracts";
import { publishTraceEvent } from "../streams/publisher";
import { TraceEventType } from "../streams/schema";

validateEnv();

const AGENT_ID = "EXECUTOR-B";
const PRIVATE_KEY = process.env.PRIVATE_KEY_AGENT_B as `0x${string}`;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [${AGENT_ID}] ${msg}`);
}

const STATUS_EXECUTOR_SELECTED = 2n;
const STATUS_UPDATED_TOPIC = keccak256(toHex("StatusUpdated(bytes32,uint8)"));

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
    `Executor B executed settlement`
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

    const intentId = topics[1] as `0x${string}`;

    let newStatus: bigint;
    try {
      const dataHex: `0x${string}` = logEntry.data;
      newStatus = BigInt("0x" + dataHex.slice(2, 66));
    } catch {
      log(`Failed to decode log data`);
      return;
    }

    if (newStatus !== STATUS_EXECUTOR_SELECTED) return;

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

    try {
      await executeSettlement(walletClient, publicClient, intentId);
    } catch (err) {
      log(`executeSettlement failed: ${err}`);
      await publishTraceEvent(
        intentId,
        TraceEventType.PaymentFailed,
        account.address,
        toHex("agent-b-tx-failed", { size: 32 }),
        `Executor B tx failed: ${String(err).slice(0, 120)}`
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
