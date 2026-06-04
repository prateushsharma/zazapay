import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import IntentCard from '../../components/IntentCard/IntentCard'
import { api, PaymentIntent } from '../../lib/api'
import './History.css'

export default function History() {
  const [intents, setIntents]   = useState<PaymentIntent[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [intentId, setIntentId] = useState('')
  const [searched, setSearched] = useState<PaymentIntent | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)

  useEffect(() => {
    // load last 10 from localStorage if API doesn't have a list endpoint
    const stored = localStorage.getItem('zazapay_intent_ids')
    if (!stored) { setLoading(false); return }
    const ids: string[] = JSON.parse(stored).slice(-10).reverse()
    Promise.all(ids.map(id => api.getIntent(id).catch(() => null)))
      .then(results => setIntents(results.filter(Boolean) as PaymentIntent[]))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSearch = async () => {
    if (!intentId.trim()) return
    setSearchErr(null)
    setSearching(true)
    try {
      const data = await api.getIntent(intentId.trim())
      setSearched(data)
    } catch (e: any) {
      setSearchErr(e.message)
      setSearched(null)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="history-page">
      <nav className="history-page__nav">
        <div className="history-page__nav-brand">
          <span className="history-page__nav-logo">⬡</span>
          <span className="history-page__nav-name">ZaZaPay</span>
        </div>
        <div className="history-page__nav-links">
          <Link to="/" className="history-page__nav-link">Dashboard</Link>
          <Link to="/history" className="history-page__nav-link history-page__nav-link--active">History</Link>
          <Link to="/agents" className="history-page__nav-link">Agents</Link>
        </div>
      </nav>

      <div className="history-page__body">
        <div className="history-page__header">
          <h1 className="history-page__title">Payment History</h1>
          <p className="history-page__sub">All submitted intents from this session</p>
        </div>

        {/* search */}
        <div className="history-page__search">
          <input
            className="history-page__search-input"
            type="text"
            placeholder="Look up intent by ID (0x...)"
            value={intentId}
            onChange={e => setIntentId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="history-page__search-btn"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? <span className="history-page__spinner" /> : 'Look up'}
          </button>
        </div>

        {searchErr && (
          <div className="history-page__error">{searchErr}</div>
        )}

        {searched && (
          <motion.div
            className="history-page__searched"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="history-page__section-label">Search result</p>
            <IntentCard intent={searched} expanded />
          </motion.div>
        )}

        {/* list */}
        <div className="history-page__section-label">Recent intents</div>

        {loading && (
          <div className="history-page__loading">
            <span className="history-page__spinner" />
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="history-page__error">{error}</div>
        )}

        {!loading && intents.length === 0 && !error && (
          <div className="history-page__empty">
            No intents yet.{' '}
            <Link to="/">Submit one from the dashboard.</Link>
          </div>
        )}

        <div className="history-page__list">
          {intents.map((intent, i) => (
            <motion.div
              key={intent.intentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <IntentCard intent={intent} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
