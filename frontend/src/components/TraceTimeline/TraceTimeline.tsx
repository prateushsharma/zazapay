import { motion, AnimatePresence } from 'framer-motion'
import type { TraceEvent } from '../../lib/api'
import { TRACE_EVENT_COLORS } from '../../lib/constants'
import { truncateAddr, truncateHash, explorerTx, formatTimestamp } from '../../lib/chain'
import './TraceTimeline.css'

const EVENT_ICONS: Record<string, string> = {
  PaymentIntentCreated:    'O',
  SettlementPlanSubmitted: 'P',
  ExecutorSelected:        'E',
  PaymentExecuted:         'X',
  PaymentVerified:         'V',
  PaymentFailed:           'F',
}

interface Props {
  events: TraceEvent[]
  loading: boolean
}

export default function TraceTimeline({ events, loading }: Props) {
  return (
    <div className="trace-timeline">
      <div className="trace-timeline__header">
        <h3 className="trace-timeline__title">Data Streams Trace</h3>
        {loading && events.length === 0 && (
          <span className="trace-timeline__loading">
            <span className="trace-timeline__spinner" />
            Awaiting events...
          </span>
        )}
        {events.length > 0 && <span className="trace-timeline__badge">{events.length} events</span>}
      </div>

      {events.length === 0 && !loading && (
        <div className="trace-timeline__empty">No trace events yet. Submit an intent to begin.</div>
      )}

      <div className="trace-timeline__list">
        <AnimatePresence initial={false}>
          {events.map((ev, i) => {
            const color = TRACE_EVENT_COLORS[ev.eventType] ?? 'var(--text-muted)'
            const icon  = EVENT_ICONS[ev.eventType] ?? '*'

            return (
              <motion.div key={`${ev.txHash}-${i}`} className="trace-event" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <div className="trace-event__spine">
                  <div className="trace-event__icon" style={{ color, borderColor: color + '44', background: color + '11' }}>
                    {icon}
                  </div>
                  {i < events.length - 1 && <div className="trace-event__line" />}
                </div>

                <div className="trace-event__content">
                  <div className="trace-event__top">
                    <span className="trace-event__type" style={{ color }}>{ev.eventType}</span>
                    <span className="trace-event__time">{formatTimestamp(ev.timestamp)}</span>
                  </div>

                  {ev.message && <p className="trace-event__message">{ev.message}</p>}

                  <div className="trace-event__meta">
                    {ev.actor && (
                      <span className="trace-event__meta-item">
                        <span className="trace-event__meta-label">actor</span>
                        <span className="mono trace-event__meta-val">{truncateAddr(ev.actor)}</span>
                      </span>
                    )}
                    {ev.txHash && (
                      <span className="trace-event__meta-item">
                        <span className="trace-event__meta-label">tx</span>
                        <a className="trace-event__tx-link" href={explorerTx(ev.txHash)} target="_blank" rel="noreferrer">{truncateHash(ev.txHash)}</a>
                      </span>
                    )}
                    {ev.blockNumber && (
                      <span className="trace-event__meta-item">
                        <span className="trace-event__meta-label">block</span>
                        <span className="mono trace-event__meta-val">#{ev.blockNumber}</span>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
