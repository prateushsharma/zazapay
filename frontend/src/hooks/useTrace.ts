import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { TraceEvent } from '../lib/api'
import { POLL_INTERVAL_MS } from '../lib/constants'

export function useTrace(intentId: string | null) {
  const [events, setEvents]   = useState<TraceEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = async (id: string) => {
    try {
      const data = await api.getTrace(id)
      setEvents(data.events)
      setError(null)
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

  return { events, loading, error }
}
