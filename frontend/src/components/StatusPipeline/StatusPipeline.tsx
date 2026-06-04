import { motion } from 'framer-motion'
import { STATUS_LABELS, STATUS_COLORS } from '../../lib/constants'
import { explorerTx, truncateHash, formatTimestamp } from '../../lib/chain'
import './StatusPipeline.css'

interface StageInfo {
  status: number
  timestamp?: number
  txHash?: string
}

interface Props {
  currentStatus: number
  stages?: Partial<Record<number, StageInfo>>
  selectedExecutor?: string
}

const PIPELINE_STEPS = [0, 1, 2, 3, 4]

export default function StatusPipeline({ currentStatus, stages = {}, selectedExecutor }: Props) {
  return (
    <div className="status-pipeline">
      <div className="status-pipeline__track">
        {PIPELINE_STEPS.map((step, idx) => {
          const done   = currentStatus > step
          const active = currentStatus === step
          const color  = STATUS_COLORS[step]
          const info   = stages[step]

          return (
            <div key={step} className="status-pipeline__step-wrap">
              {idx > 0 && (
                <div className={`status-pipeline__connector ${done ? 'status-pipeline__connector--done' : ''}`} style={done ? { background: `linear-gradient(90deg, ${STATUS_COLORS[step - 1]}, ${STATUS_COLORS[step]})` } : {}} />
              )}
              <div className="status-pipeline__step">
                <motion.div
                  className={`status-pipeline__node ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                  style={{ borderColor: done || active ? color : 'var(--border)', boxShadow: active ? `0 0 16px ${color}55` : done ? `0 0 8px ${color}33` : 'none' }}
                  animate={active ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : active ? (
                    <motion.div className="status-pipeline__pulse" style={{ background: color }} animate={{ scale: [0.6, 1, 0.6], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                  ) : (
                    <div className="status-pipeline__empty" />
                  )}
                </motion.div>

                <div className="status-pipeline__label">
                  <span className="status-pipeline__name" style={{ color: done || active ? color : 'var(--text-muted)' }}>
                    {STATUS_LABELS[step]}
                  </span>
                  {info?.timestamp && <span className="status-pipeline__time">{formatTimestamp(info.timestamp)}</span>}
                  {info?.txHash && <a className="status-pipeline__tx" href={explorerTx(info.txHash)} target="_blank" rel="noreferrer">{truncateHash(info.txHash)}</a>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedExecutor && currentStatus >= 2 && (
        <motion.div className="status-pipeline__executor" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="status-pipeline__executor-label">Selected Executor</span>
          <span className="status-pipeline__executor-addr mono">{selectedExecutor}</span>
        </motion.div>
      )}

      {currentStatus === 5 && (
        <motion.div className="status-pipeline__failed-badge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          PAYMENT FAILED
        </motion.div>
      )}
    </div>
  )
}
