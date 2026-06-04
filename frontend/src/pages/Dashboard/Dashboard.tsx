import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import AgentGraph from '../../components/AgentGraph/AgentGraph'
import IntentForm from '../../components/IntentForm/IntentForm'
import StatusPipeline from '../../components/StatusPipeline/StatusPipeline'
import AgentPanel from '../../components/AgentPanel/AgentPanel'
import TraceTimeline from '../../components/TraceTimeline/TraceTimeline'
import { useIntent } from '../../hooks/useIntent'
import { useAgents } from '../../hooks/useAgents'
import { useTrace } from '../../hooks/useTrace'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { truncateAddr, explorerTx, truncateHash } from '../../lib/chain'
import './Dashboard.css'

const PAYOUT_COLORS = ['#00fff0', '#7c3aed', '#f59e0b', '#00ff88']

export default function Dashboard() {
  const [intentId, setIntentId]   = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(true)

  const { intent, loading: intentLoading } = useIntent(intentId)
  const { agents, loading: agentsLoading } = useAgents()
  const { events, loading: traceLoading }  = useTrace(intentId)

  const handleIntentCreated = (id: string, txHash: string) => {
    setIntentId(id)
    setLastTxHash(txHash)
    setShowForm(false)
  }

  const payoutData = intent?.recipients?.map((r, i) => ({
    name: r.role,
    value: r.bps / 100,
    fill: PAYOUT_COLORS[i] ?? '#888',
  })) ?? []

  const failedExecutor = agents.find(a =>
    a.role.toLowerCase().includes('executor') && a.failCount > 0
  )?.address

  return (
    <div className="dashboard">
      {/* nav */}
      <nav className="dashboard__nav">
        <div className="dashboard__nav-brand">
          <span className="dashboard__nav-logo">⬡</span>
          <span className="dashboard__nav-name">ZaZaPay</span>
          <span className="dashboard__nav-tag">Somnia Agentic L1</span>
        </div>
        <div className="dashboard__nav-links">
          <Link to="/" className="dashboard__nav-link dashboard__nav-link--active">Dashboard</Link>
          <Link to="/history" className="dashboard__nav-link">History</Link>
          <Link to="/agents" className="dashboard__nav-link">Agents</Link>
        </div>
        <div className="dashboard__nav-status">
          <span className="dashboard__nav-dot" />
          Somnia Testnet
        </div>
      </nav>

      {/* hero */}
      <section className="dashboard__hero">
        <div className="dashboard__hero-graph">
          <AgentGraph />
        </div>
        <div className="dashboard__hero-copy">
          <motion.h1
            className="dashboard__hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            One Intent.<br />
            <span className="dashboard__hero-accent">Zero Intervention.</span>
          </motion.h1>
          <motion.p
            className="dashboard__hero-sub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            dApps submit a payment intent once. Somnia Agents plan,
            negotiate, execute, verify, and receipt — entirely on-chain.
          </motion.p>
          {!intentId && (
            <motion.button
              className="dashboard__hero-cta"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onClick={() => setShowForm(true)}
            >
              Submit Payment Intent →
            </motion.button>
          )}
        </div>
      </section>

      {/* grid */}
      <div className="dashboard__grid">

        {/* left col */}
        <div className="dashboard__col-main">

          {/* intent form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <IntentForm onIntentCreated={handleIntentCreated} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* post-submit banner */}
          <AnimatePresence>
            {intentId && lastTxHash && (
              <motion.div
                className="dashboard__submitted-banner"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="dashboard__submitted-left">
                  <span className="dashboard__submitted-dot" />
                  <div>
                    <p className="dashboard__submitted-title">Intent submitted on-chain</p>
                    <p className="dashboard__submitted-id mono">{truncateAddr(intentId, 12, 8)}</p>
                  </div>
                </div>
                <div className="dashboard__submitted-right">
                  
                    className="dashboard__submitted-tx"
                    href={explorerTx(lastTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateHash(lastTxHash)}↗
                  </a>
                  <button
                    className="dashboard__submitted-new"
                    onClick={() => { setIntentId(null); setLastTxHash(null); setShowForm(true) }}
                  >
                    New Intent
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* status pipeline */}
          <AnimatePresence>
            {intent && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <StatusPipeline
                  currentStatus={intent.status}
                  selectedExecutor={intent.selectedExecutor}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* payout bars — show when settled */}
          <AnimatePresence>
            {intent && intent.status >= 3 && payoutData.length > 0 && (
              <motion.div
                className="dashboard__payout"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 className="dashboard__payout-title">Recipient Payout Breakdown</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={payoutData} layout="vertical" margin={{ left: 16, right: 24 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis type="category" dataKey="name" width={64}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0d0d14',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.72rem',
                        color: '#f0f0f0',
                      }}
                      formatter={(v: number) => [`${v}%`]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {payoutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </AnimatePresence>

          {/* trace timeline */}
          {intentId && (
            <TraceTimeline events={events} loading={traceLoading} />
          )}
        </div>

        {/* right col — agent panel */}
        <div className="dashboard__col-side">
          <AgentPanel
            agents={agents}
            loading={agentsLoading}
            selectedExecutor={intent?.selectedExecutor}
            failedExecutor={failedExecutor}
          />
        </div>
      </div>
    </div>
  )
}
