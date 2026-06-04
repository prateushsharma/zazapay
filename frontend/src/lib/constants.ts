export const API_BASE = 'http://localhost:3000'
export const EXPLORER_BASE = 'https://shannon-explorer.somnia.network'
export const CHAIN_ID = 50312

export const CONTRACTS = {
  MockERC20:             '0x286f0E199804F1d2F4936A327590f9AECb262086',
  AgentRegistry:         '0x963e386d0c3e0f54ab2a12fe67b4c3fc78443ff7',
  PaymentIntentRegistry: '0xf7b4f680aaddab9247423e1d833e038c760aa1e6',
  SettlementEngine:      '0x05e4f7a539d9b4e1629a0bce11722d9d918d38cf',
  PlannerGateway:        '0xc156d8137b8a9b0de18d4001a75e9448e3d3ea6b',
  NegotiationGateway:    '0x40c35f825ba88b84ad23a2f3642f4d8a19b2e8f5',
  VerifierGateway:       '0x454e26a4a621cbf271d03a5c55053c71b846e408',
} as const

export const STATUS_LABELS: Record<number, string> = {
  0: 'CREATED',
  1: 'PLANNED',
  2: 'EXECUTOR_SELECTED',
  3: 'SETTLED',
  4: 'VERIFIED',
  5: 'FAILED',
}

export const STATUS_COLORS: Record<number, string> = {
  0: 'var(--text-muted)',
  1: 'var(--accent-blue)',
  2: 'var(--accent-amber)',
  3: 'var(--accent-violet)',
  4: 'var(--accent-green)',
  5: 'var(--accent-red)',
}

export const TRACE_EVENT_COLORS: Record<string, string> = {
  PaymentIntentCreated:    'var(--accent-blue)',
  SettlementPlanSubmitted: 'var(--accent-violet)',
  ExecutorSelected:        'var(--accent-amber)',
  PaymentExecuted:         'var(--accent-green)',
  PaymentVerified:         'var(--accent-cyan)',
  PaymentFailed:           'var(--accent-red)',
}

export const DEFAULT_RECIPIENTS = [
  { role: 'seller',   address: '0x8b69547b7fa91F95fA0279c7F6708879398bfC1A', bps: 8000 },
  { role: 'creator',  address: '0x286f0E199804F1d2F4936A327590f9AECb262086', bps: 1000 },
  { role: 'platform', address: '0x76c4EEd426Ead6dC780Fa90c0E0F3b763D60652a', bps: 500  },
  { role: 'executor', address: '0x83985c6f5572c527e3247f5640c826649aA300fa', bps: 500  },
]

export const POLL_INTERVAL_MS = 3000
