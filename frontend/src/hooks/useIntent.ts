import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { PaymentIntent } from '../lib/api'
import { POLL_INTERVAL_MS } from '../lib/constants'

export function useIntent(intentId: string | null) {
  const [intent, setIntent]   = useState<PaymentIntent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = async (id: string) => {
    try {
      const data = await api.getIntent(id)
      setIntent(data)
      setError(null)
      // stop polling once terminal state
      if (data.status >= 4) {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => {
    if (!intentId) return
    setLoading(true)
    fetch(intentId).finally(() => setLoading(false))
    timerRef.current = setInterval(() => fetch(intentId), POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intentId])

  return { intent, loading, error }
}
