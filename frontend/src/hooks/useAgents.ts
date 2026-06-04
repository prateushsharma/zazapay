import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import type { Agent } from '../lib/api'
import { POLL_INTERVAL_MS } from '../lib/constants'

export function useAgents() {
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = async () => {
    try {
      const data = await api.getAgents()
      setAgents(data.agents)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetch().finally(() => setLoading(false))
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { agents, loading, error }
}
