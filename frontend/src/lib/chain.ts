import { EXPLORER_BASE } from './constants'

export function explorerTx(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`
}

export function explorerAddress(addr: string): string {
  return `${EXPLORER_BASE}/address/${addr}`
}

export function truncateAddr(addr: string, front = 6, back = 4): string {
  if (!addr) return ''
  return `${addr.slice(0, front)}...${addr.slice(-back)}`
}

export function truncateHash(hash: string, front = 8, back = 6): string {
  if (!hash) return ''
  return `${hash.slice(0, front)}...${hash.slice(-back)}`
}

export function formatTimestamp(ts: number | string): string {
  const d = new Date(typeof ts === 'string' ? ts : ts * 1000)
  return d.toLocaleTimeString('en-US', { hour12: false }) + ' ' +
         d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
