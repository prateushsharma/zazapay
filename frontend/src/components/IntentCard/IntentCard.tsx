import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PaymentIntent } from '../../lib/api'
import { STATUS_LABELS, STATUS_COLORS } from '../../lib/constants'
import { truncateAddr, truncateHash, explorerTx, formatTimestamp } from '../../lib/chain'
import './IntentCard.css'

interface Props {
  intent: PaymentIntent
  expanded?: boolean
}

export default function IntentCard({ intent, expanded: defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const statusColor = STATUS_COLORS[intent.status] ?? 'var(--text-muted)'
  const statusLabel = STATUS_LABELS[intent.status] ?? 'UNKNOWN'

  return (
    <div
      className={`intent-card ${expanded ? 'intent-card--expanded' : ''}`}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="intent-card__row">
        <div className="intent-card__left">
          <span className="intent-card__id mono">
            {truncateAddr(intent.intentId, 10, 6)}
          </span>
          <span
            className="intent-card__status"
            style={{ color: statusColor, borderColor: statusColor + '44', background: statusColor + '11' }}
          >
            {statusLabel}
          </span>
        </div>

        <div className="intent-card__right">
          <span className="intent-card__amount">
            {intent.amount} <span className="intent-card__token">{intent.token}</span>
          </span>
          <span className="intent-card__time">
            {formatTimestamp(intent.createdAt)}
          </span>
          <span className={`intent-card__chevron ${expanded ? 'intent-card__chevron--open' : ''}`}>
            ›
          </span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="intent-card__detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="intent-card__detail-grid">
              <div className="intent-card__detail-item">
                <span className="intent-card__detail-label">Intent ID</span>
                <span className="intent-card__detail-val mono">{intent.intentId}</span>
              </div>
              <div className="intent-card__detail-item">
                <span className="intent-card__detail-label">Context</span>
                <span className="intent-card__detail-val">{intent.context}</span>
              </div>
              <div className="intent-card__detail-item">
                <span className="intent-card__detail-label">Payer</span>
                <span className="intent-card__detail-val mono">{truncateAddr(intent.payer, 10, 6)}</span>
              </div>
              {intent.selectedExecutor && (
                <div className="intent-card__detail-item">
                  <span className="intent-card__detail-label">Executor</span>
                  <span className="intent-card__detail-val mono" style={{ color: 'var(--accent-amber)' }}>
                    {truncateAddr(intent.selectedExecutor, 10, 6)}
                  </span>
                </div>
              )}
            </div>

            {intent.recipients && intent.recipients.length > 0 && (
              <div className="intent-card__recipients">
                <span className="intent-card__detail-label">Recipients</span>
                <div className="intent-card__recipient-list">
                  {intent.recipients.map((r, i) => (
                    <div key={i} className="intent-card__recipient">
                      <span className="intent-card__recipient-role">{r.role}</span>
                      <span className="intent-card__recipient-addr mono">
                        {truncateAddr(r.address)}
                      </span>
                      <span className="intent-card__recipient-bps">
                        {r.bps / 100}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intent.txHashes && Object.keys(intent.txHashes).length > 0 && (
              <div className="intent-card__txhashes">
                <span className="intent-card__detail-label">Transactions</span>
                {Object.entries(intent.txHashes).map(([stage, hash]) => (
                  <div key={stage} className="intent-card__txhash-row">
                    <span className="intent-card__txhash-stage mono">{stage}</span>
                    
                      className="intent-card__txhash-link"
                      href={explorerTx(hash)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      {truncateHash(hash)}↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
