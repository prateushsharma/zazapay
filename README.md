# ZaZaPay

Autonomous payment settlement infrastructure for Somnia dApps. Submit a payment intent once — ZaZaPay's agent network handles planning, executor negotiation, token settlement, verification, and receipt generation entirely on-chain with zero human intervention after submission.

---

## Overview

Payment coordination in Web3 is broken. Developers hardcode splits, trust off-chain scripts to execute them, and have no on-chain validation that anything happened correctly. ZaZaPay replaces this entire stack with a network of Somnia Agents operating through on-chain Reactivity — every step is autonomous, verifiable, and auditable.

The architecture has no centralized orchestrator. Contracts subscribe to each other's events via Somnia Reactivity. Each event triggers the next agent in the chain. The full settlement lifecycle from intent creation to verified receipt runs on-chain, driven by Somnia's native agent infrastructure.

---

## Architecture

```
dApp
  POST /v1/payment-intents
          │
          ▼
┌─────────────────────────────────────┐
│       PaymentIntentRegistry         │
│  Creates intent, emits              │
│  PaymentIntentCreated event         │
└──────────────┬──────────────────────┘
               │ On-chain Reactivity
               ▼
┌─────────────────────────────────────┐
│          PlannerGateway             │
│  Calls Somnia LLM Inference Agent   │
│  Validates BPS totals, token,       │
│  recipients, deadline               │
│  handlePlannerResponse()            │
│  → status: PLANNED                  │
└──────────────┬──────────────────────┘
               │ On-chain Reactivity
               ▼
┌─────────────────────────────────────┐
│        NegotiationGateway           │
│  Calls Somnia JSON API Agent        │
│  Fetches live executor fee quotes   │
│  Selects optimal executor           │
│  handleNegotiationResponse()        │
│  → status: EXECUTOR_SELECTED        │
└──────────────┬──────────────────────┘
               │ Off-chain Reactivity (WebSocket)
               ▼
┌─────────────────────────────────────┐
│          ExecutorAgent              │
│  Off-chain TypeScript wallet        │
│  Calls SettlementEngine             │
│  Splits ERC20 tokens via BPS math   │
│  → status: SETTLED                  │
└──────────────┬──────────────────────┘
               │ On-chain Reactivity
               ▼
┌─────────────────────────────────────┐
│          VerifierGateway            │
│  Calls Somnia LLM Inference Agent   │
│  Verifies on-chain balances match   │
│  declared splits                    │
│  handleVerifierResponse()           │
│  → status: VERIFIED                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      PaymentReceiptRegistry         │
│  Stores verified receipt on-chain   │
│  Data Streams SDK publishes         │
│  full structured trace              │
└─────────────────────────────────────┘
```

### Autonomous Failover

```
ExecutorAgent A  →  fails / times out
                         │
                         ▼
             NegotiationGateway detects timeout
             Re-runs executor selection
                         │
                         ▼
ExecutorAgent B  →  executes settlement
                         │
                         ▼
             VerifierGateway verifies
             → status: VERIFIED

Human intervention after intent creation: 0
```

---

## Somnia Infrastructure

### Somnia Agents — LLM Inference

`PlannerGateway` and `VerifierGateway` invoke Somnia's LLM Inference Agent directly from Solidity using the `ISomniaAgents` interface. The planner validates payment splits, BPS totals, and token support before settlement begins. The verifier confirms post-settlement on-chain balances match the declared recipients after settlement completes.

```solidity
platform.createRequest{value: deposit}(
    LLM_INFERENCE_AGENT_ID,
    address(this),
    this.handlePlannerResponse.selector,
    abi.encode(intentId, recipientsJson, validationPrompt)
);

function handlePlannerResponse(
    uint256 requestId,
    Response[] calldata responses,
    ResponseStatus status,
    Request calldata details
) external onlySomniaAgents {
    if (status == ResponseStatus.Success) {
        registry.updateStatus(intentId, PaymentStatus.PLANNED);
    }
}
```

### Somnia Agents — JSON API Request

`NegotiationGateway` calls the JSON API Agent to fetch live executor fee quotes from an external endpoint, then selects the optimal executor on-chain based on fee and latency. Executor selection is deterministic, on-chain, and driven entirely by real-time data fetched by a Somnia Agent.

### Somnia On-chain Reactivity

All five contracts are wired together via Somnia Reactivity subscriptions with no off-chain orchestration layer:

| Subscription | Trigger | Handler |
|---|---|---|
| `PaymentIntentCreated` | PaymentIntentRegistry | PlannerGateway.onEvent() |
| `StatusUpdated(PLANNED)` | PaymentIntentRegistry | NegotiationGateway.onEvent() |
| `StatusUpdated(SETTLED)` | PaymentIntentRegistry | VerifierGateway.onEvent() |

Contracts react to each other's events within the same block. Somnia's sub-second finality makes this practical — the full coordination chain completes in seconds, not minutes.

Subscriptions verified on-chain:
```bash
curl -X POST https://dream-rpc.somnia.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"somnia_reactivityGetSubscriptions","params":["CONTRACT_ADDRESS"],"id":1}'
```

### Somnia Data Streams

Every state transition publishes a structured record to a registered Data Streams schema. The result is an immutable, queryable, public audit trail for every payment that any subscriber can read.

```typescript
const paymentTraceSchema =
  "uint64 timestamp, bytes32 intentId, uint8 eventType, address actor, bytes32 dataHash, string message";

// Event types
// 0 = PaymentIntentCreated
// 1 = SettlementPlanSubmitted
// 2 = ExecutorQuoteSubmitted
// 3 = ExecutorSelected
// 4 = PaymentExecuted
// 5 = PaymentVerified
// 6 = PaymentFailed
// 7 = PaymentReceiptCreated

import { SDK, SchemaEncoder } from "@somnia-chain/streams";

const enc = new SchemaEncoder(paymentTraceSchema);
const payload = enc.encodeData([
  { name: "timestamp",  value: Date.now().toString(), type: "uint64"  },
  { name: "intentId",   value: intentId,              type: "bytes32" },
  { name: "eventType",  value: "4",                   type: "uint8"   },
  { name: "actor",      value: executorAddress,        type: "address" },
  { name: "dataHash",   value: settlementHash,         type: "bytes32" },
  { name: "message",    value: "Settlement executed",  type: "string"  },
]);

await sdk.streams.set([{ id: dataId, schemaId, data: payload }]);
```

---

## Deployed Contracts

Network: **Somnia Testnet (Shannon)** — chainId `50312`

| Contract | Address |
|---|---|
| MockERC20 | `0x286f0E199804F1d2F4936A327590f9AECb262086` |
| AgentRegistry | `0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7` |
| PaymentIntentRegistry | `0xf7b4f680aaddab9247423e1d833e038c760aa1e6` |
| SettlementEngine | `0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf` |
| PlannerGateway | `0xc156d8137b8a9b0de18d4001a75e9448e3d3ea6b` |
| NegotiationGateway | `0x40c35f825ba88b84ad23a2f3642f4d8a19b2e8f5` |
| VerifierGateway | `0x454e26a4a621cbf271d03a5c55053c71b846e408` |

Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)

Somnia Agents platform (testnet): `0xaD3101C37F091593fEe7cb471e92b5E9A1205194`

---

## Smart Contracts

### PaymentIntentRegistry

Core state machine. Stores all intent data on-chain: payer, token, amount, recipients with BPS allocations, policy flags, deadline, selected executor, and plan hash. Enforces the `CREATED → PLANNED → EXECUTOR_SELECTED → SETTLED → VERIFIED` transition table. Emits events at each transition that Reactivity subscriptions listen to. Requires an `authorizedCaller` pattern — only whitelisted gateways can update status.

### PlannerGateway

Implements `IAgentRequesterHandler`. Subscribed via Reactivity to `PaymentIntentCreated`. On trigger, reads the intent from `PaymentIntentRegistry`, constructs a validation prompt with recipient JSON and BPS totals, and submits a `createRequest` to the Somnia Agents platform. Receives the async LLM response in `handlePlannerResponse`. On success, advances status to `PLANNED`. On `ResponseStatus.TimedOut` or `ResponseStatus.Failed`, marks the intent as `FAILED`.

### NegotiationGateway

Subscribed via Reactivity to `StatusUpdated(PLANNED)`. Calls the JSON API Agent with the executor feed URL to fetch current fee quotes. In `handleNegotiationResponse`, parses the quote, selects the executor with the lowest fee within the deadline window, writes `selectedExecutor` to the registry, and advances status to `EXECUTOR_SELECTED`. Implements executor timeout detection — if an executor fails to settle within the deadline, re-triggers selection and picks the backup executor.

### SettlementEngine

Called directly by registered `ExecutorAgent` wallets via `executeSettlement(intentId)`. Reads intent data from `PaymentIntentRegistry`, validates executor authorization via `AgentRegistry`, transfers the full amount from the payer, and distributes tokens to each recipient using BPS math (`amount * bps / 10000`). Reentrancy-guarded. Checks intent is in `EXECUTOR_SELECTED` status before proceeding.

### VerifierGateway

Subscribed via Reactivity to `StatusUpdated(SETTLED)`. Calls the Somnia LLM Inference Agent with post-settlement balance data. The agent verifies each recipient received the correct amount. In `handleVerifierResponse`, on success, writes the receipt to `PaymentReceiptRegistry` and advances status to `VERIFIED`.

### AgentRegistry

Tracks all registered executor agents with their wallet address, role, capability flags, heartbeat timestamp, success count, and failure count. `SettlementEngine` queries this registry to verify executor authorization before permitting settlement.

---

## API Reference

The REST API is a stateless on-chain bridge. All state lives in contracts.

```
POST   /v1/payment-intents            Create intent on-chain
GET    /v1/payment-intents/:id        Read intent status + selectedExecutor + recipients
GET    /v1/payment-intents/:id/trace  Read Data Streams trace events for this intent
GET    /v1/agents                     Read all registered agents from AgentRegistry
GET    /v1/receipts/:id               Read verified receipt from PaymentReceiptRegistry
GET    /health                        Service uptime
```

**Create intent:**
```bash
curl -X POST http://localhost:3000/v1/payment-intents \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100",
    "token": "STT",
    "context": "game-item-purchase",
    "recipients": [
      { "role": "seller",   "address": "0x8b69547b7fa91F95fA0279c7F6708879398bfC1A", "bps": 8000 },
      { "role": "creator",  "address": "0x286f0E199804F1d2F4936A327590f9AECb262086", "bps": 1000 },
      { "role": "platform", "address": "0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a", "bps": 500  },
      { "role": "executor", "address": "0x83985c6f5572c527e3247f5640c826649aA300fa", "bps": 500  }
    ],
    "policy": {
      "requireAgentPlanning": true,
      "requireAgentVerification": true,
      "allowExecutorNegotiation": true,
      "deadlineSeconds": 300
    }
  }'
```

**Response:**
```json
{
  "intentId": "0x3f2a...",
  "txHash": "0x8c1d..."
}
```

**Poll status:**
```bash
curl http://localhost:3000/v1/payment-intents/0x3f2a...
```

```json
{
  "intentId": "0x3f2a...",
  "status": 4,
  "statusLabel": "VERIFIED",
  "amount": "100",
  "token": "STT",
  "selectedExecutor": "0xExecutorB...",
  "recipients": [...],
  "txHashes": {
    "PLANNED": "0x...",
    "EXECUTOR_SELECTED": "0x...",
    "SETTLED": "0x...",
    "VERIFIED": "0x..."
  }
}
```

---

## Project Structure

```
zazapay/
├── contracts/
│   ├── PaymentIntentRegistry.sol
│   ├── PlannerGateway.sol
│   ├── NegotiationGateway.sol
│   ├── SettlementEngine.sol
│   ├── VerifierGateway.sol
│   ├── PaymentReceiptRegistry.sol
│   ├── AgentRegistry.sol
│   └── MockERC20.sol
├── scripts/
│   ├── deploy.ts
│   └── setup-subscriptions.ts
├── agents/
│   ├── executor-agent-a.ts
│   ├── executor-agent-b.ts
│   └── shared/
│       ├── chain.ts
│       └── contracts.ts
├── streams/
│   ├── schema.ts
│   └── publisher.ts
├── api/
│   ├── index.ts
│   └── routes/
│       ├── intents.ts
│       ├── agents.ts
│       └── receipts.ts
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AgentGraph/
│       │   ├── StatusPipeline/
│       │   ├── TraceTimeline/
│       │   ├── AgentPanel/
│       │   └── IntentForm/
│       └── pages/
│           ├── Dashboard/
│           ├── History/
│           └── Agents/
├── hardhat.config.ts
├── .env.example
└── README.md
```

---

## Setup

### Prerequisites

- Node.js 20+
- Somnia testnet STT — faucet at [testnet.somnia.network](https://testnet.somnia.network)

### Install dependencies

```bash
git clone https://github.com/your-username/zazapay
cd zazapay
npm install
cp .env.example .env
```

### Configure environment

```bash
# .env
RPC_URL=https://api.infra.testnet.somnia.network
WS_URL=wss://api.infra.testnet.somnia.network/ws
CHAIN_ID=50312

DEPLOYER_PRIVATE_KEY=0x...
EXECUTOR_A_PRIVATE_KEY=0x...
EXECUTOR_B_PRIVATE_KEY=0x...

SOMNIA_AGENTS_CONTRACT=0xaD3101C37F091593fEe7cb471e92b5E9A1205194
LLM_INFERENCE_AGENT_ID=12875401142070969085
JSON_API_AGENT_ID=12847293847561029384

STREAMS_SCHEMA_ID=0x...
PORT=3000
```

### Deploy

```bash
npx hardhat run scripts/deploy.ts --network somnia_testnet
npx hardhat run scripts/setup-subscriptions.ts --network somnia_testnet
```

### Run executor agents

```bash
npx tsx agents/executor-agent-a.ts &
npx tsx agents/executor-agent-b.ts &
```

### Run API

```bash
npx tsx api/index.ts
```

### Run dashboard

```bash
cd frontend && npm install && npm run dev
```

---

## Network

| | |
|---|---|
| Network | Somnia Testnet (Shannon) |
| Chain ID | `50312` |
| RPC | `https://api.infra.testnet.somnia.network` |
| Alt RPC | `https://dream-rpc.somnia.network` |
| WebSocket | `wss://api.infra.testnet.somnia.network/ws` |
| Explorer | `https://shannon-explorer.somnia.network` |
| Native Token | STT |
| Block time | ~100ms |
| Finality | Sub-second |

---
Made with 🩷 by Prateush Sharma
