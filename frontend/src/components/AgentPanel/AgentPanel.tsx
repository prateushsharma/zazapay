import { motion, AnimatePresence } from 'framer-motion'
import type { Agent } from '../../lib/api'
import { truncateAddr, formatTimestamp } from '../../lib/chain'
import './AgentPanel.css'

interface Props {
  agents: Agent[]
  loading: boolean
  selectedExecutor?: string
  failedExecutor?: string
}

const ROLE_COLORS: Record<string, string> = {
  executor:    'var(--accent-cyan)',
  planner:     'var(--accent-violet)',
  verifier:    'var(--accent-green)',
  negotiator:  'var(--accent-amber)',
}

function roleColor(role: string): string {
  const key = Object.keys(ROLE_COLORS).find(k => role.toLowerCase().includes(k))
  return key ? ROLE_COLORS[key] : 'var(--text-muted)'
}

function Heartbeat({ active }: { active: boolean }) {
  return (
    <div className="heartbeat">
      <motion.span
        className="heartbeat__dot"
        style={{ background: active ? 'var(--accent-green)' : 'var(--text-muted)' }}
        animate={active ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      <span
        className="heartbeat__label"
        style={{ color: active ? 'var(--accent-green)' : 'var(--text-muted)' }}
      >
        {active ? 'ACTIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}

export default function AgentPanel({ agents, loading, selectedExecutor, failedExecutor }: Props) {
  return (
    <div className="agent-panel">
      <div className="agent-panel__header">
        <h3 className="agent-panel__title">Agent Registry</h3>
        <span className="agent-panel__count">
          {agents.filter(a => a.active).length}/{agents.length} active
        </span>
      </div>

      {loading && agents.length === 0 && (
        <div className="agent-panel__empty">
          <span className="agent-panel__spinner" />
          Fetching agents...
        </div>
      )}

      <div className="agent-panel__list">
        <AnimatePresence>
          {agents.map((agent, i) => {
            const isFailed   = failedExecutor   && agent.address.toLowerCase() === failedExecutor.toLowerCase()
            const isSelected = selectedExecutor && agent.address.toLowerCase() === selectedExecutor.toLowerCase()
            const color      = roleColor(agent.role)

            return (
              <motion.div
                key={agent.address}
                className={`agent-card ${isFailed ? 'agent-card--failed' : ''} ${isSelected ? 'agent-card--selected' : ''}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="agent-card__top">
                  <div className="agent-card__left">
                    <span
                      className="agent-card__role-badge"
                      style={{ color, borderColor: color + '44', background: color + '11' }}
                    >
                      {agent.role}
                    </span>
                    <span className="agent-card__name">{agent.name}</span>
                  </div>
                  <Heartbeat active={agent.active} />
                </div>

                <div className="agent-card__addr mono">
                  {truncateAddr(agent.address, 10, 6)}
                </div>

                <div className="agent-card__stats">
                  <div className="agent-card__stat">
                    <span className="agent-card__stat-label">Success</span>
                    <span className="agent-card__stat-val agent-card__stat-val--green">
                      {agent.successCount}
                    </span>
                  </div>
                  <div className="agent-card__stat">
                    <span className="agent-card__stat-label">Failed</span>
                    <span className="agent-card__stat-val agent-card__stat-val--red">
                      {agent.failCount}
                    </span>
                  </div>
                  {agent.lastSeen && (
                    <div className="agent-card__stat">
                      <span className="agent-card__stat-label">Last seen</span>
                      <span className="agent-card__stat-val">
                        {formatTimestamp(agent.lastSeen)}
                      </span>
                    </div>
                  )}
                </div>

                {isFailed && (
                  <motion.div
                    className="agent-card__event agent-card__event--amber"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    ⚠ assigned → skipped (failover triggered)
                  </motion.div>
                )}

                {isSelected && !isFailed && (
                  <motion.div
                    className="agent-card__event agent-card__event--green"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    ✓ assigned → executed
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
