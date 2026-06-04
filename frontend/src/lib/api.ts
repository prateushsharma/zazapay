const API_BASE = 'http://localhost:3000'

export interface Recipient {
  role: string
  address: string
  bps: number
}

export interface PaymentPolicy {
  requireAgentPlanning: boolean
  requireAgentVerification: boolean
  allowExecutorNegotiation: boolean
  deadlineSeconds: number
}

export interface CreateIntentPayload {
  amount: string
  token: string
  context: string
  recipients: Recipient[]
  policy: PaymentPolicy
}

export interface PaymentIntent {
  intentId: string
  status: number
  statusLabel: string
  amount: string
  token: string
  context: string
  payer: string
  recipients: Recipient[]
  selectedExecutor?: string
  txHashes?: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface TraceEvent {
  eventType: string
  actor: string
  txHash: string
  message: string
  timestamp: number
  blockNumber?: number
}

export interface Agent {
  address: string
  role: string
  name: string
  active: boolean
  successCount: number
  failCount: number
  lastSeen?: number
}

export interface PaymentReceipt {
  intentId: string
  executor: string
  verifier: string
  txHash: string
  amount: string
  recipientCount: number
  verified: boolean
  timestamp: number
  receiptHash: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: () =>
    request<{ status: string; uptime: number }>('/health'),

  createIntent: (payload: CreateIntentPayload) =>
    request<{ intentId: string; txHash: string }>('/v1/payment-intents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getIntent: (id: string) =>
    request<PaymentIntent>(`/v1/payment-intents/${id}`),

  getTrace: (id: string) =>
    request<{ events: TraceEvent[] }>(`/v1/payment-intents/${id}/trace`),

  getAgents: () =>
    request<{ agents: Agent[] }>('/v1/agents'),

  getReceipt: (id: string) =>
    request<PaymentReceipt>(`/v1/receipts/${id}`),
}
