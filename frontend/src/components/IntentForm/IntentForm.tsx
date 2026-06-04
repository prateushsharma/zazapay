import { useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../lib/api'
import type { CreateIntentPayload } from '../../lib/api'
import { DEFAULT_RECIPIENTS } from '../../lib/constants'
import './IntentForm.css'

const PIE_COLORS = ['#00fff0', '#7c3aed', '#f59e0b', '#00ff88']

interface Props {
  onIntentCreated: (intentId: string, txHash: string) => void
}

export default function IntentForm({ onIntentCreated }: Props) {
  const [amount, setAmount]   = useState('100')
  const [context, setContext] = useState('game-item-purchase')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const recipients = DEFAULT_RECIPIENTS

  const pieData = recipients.map(r => ({
    name: r.role,
    value: r.bps / 100,
  }))

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      const payload: CreateIntentPayload = {
        amount,
        token: 'STT',
        context,
        recipients,
        policy: {
          requireAgentPlanning: true,
          requireAgentVerification: true,
          allowExecutorNegotiation: true,
          deadlineSeconds: 300,
        },
      }
      const res = await api.createIntent(payload)
      onIntentCreated(res.intentId, res.txHash)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="intent-form">
      <div className="intent-form__header">
        <h2 className="intent-form__title">Submit Payment Intent</h2>
        <span className="intent-form__subtitle">One intent. Zero intervention.</span>
      </div>

      <div className="intent-form__body">
        <div className="intent-form__fields">
          <div className="intent-form__field">
            <label className="intent-form__label">Amount</label>
            <div className="intent-form__input-wrap">
              <input
                className="intent-form__input"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
              />
              <span className="intent-form__input-suffix">STT</span>
            </div>
          </div>

          <div className="intent-form__field">
            <label className="intent-form__label">Context</label>
            <input
              className="intent-form__input"
              type="text"
              value={context}
              onChange={e => setContext(e.target.value)}
            />
          </div>

          <div className="intent-form__field">
            <label className="intent-form__label">Policy</label>
            <div className="intent-form__policy-tags">
              <span className="intent-form__tag intent-form__tag--on">Agent Planning</span>
              <span className="intent-form__tag intent-form__tag--on">Agent Verification</span>
              <span className="intent-form__tag intent-form__tag--on">Executor Negotiation</span>
              <span className="intent-form__tag">Deadline: 5 min</span>
            </div>
          </div>

          <div className="intent-form__field">
            <label className="intent-form__label">Recipients</label>
            <div className="intent-form__recipients">
              {recipients.map((r, i) => (
                <div key={r.role} className="intent-form__recipient">
                  <span className="intent-form__recipient-dot" style={{ background: PIE_COLORS[i] }} />
                  <span className="intent-form__recipient-role">{r.role}</span>
                  <span className="intent-form__recipient-addr mono">
                    {r.address.slice(0, 6)}...{r.address.slice(-4)}
                  </span>
                  <span className="intent-form__recipient-bps" style={{ color: PIE_COLORS[i] }}>
                    {r.bps / 100}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="intent-form__chart">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} opacity={0.85} />
                ))}
              </Pie>
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
            </PieChart>
          </ResponsiveContainer>
          <p className="intent-form__chart-label">Split Preview</p>
        </div>
      </div>

      {error && (
        <div className="intent-form__error">{error}</div>
      )}

      <button
        className={`intent-form__submit ${loading ? 'intent-form__submit--loading' : ''}`}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="intent-form__spinner" />
            Submitting on-chain...
          </>
        ) : (
          'Submit Payment Intent →'
        )}
      </button>
    </div>
  )
}
