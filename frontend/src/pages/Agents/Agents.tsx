import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAgents } from '../../hooks/useAgents'
import { truncateAddr, explorerAddress, formatTimestamp } from '../../lib/chain'
import './Agents.css'

const ROLE_COLORS: Record<string, string> = {
  executor:   'var(--accent-cyan)',
  planner:    'var(--accent-violet)',
  verifier:   'var(--accent-green)',
  negotiator: 'var(--accent-amber)',
}

function roleColor(role: string) {
  const key = Object.keys(ROLE_COLORS).find(k => role.toLowerCase().includes(k))
  return key ? ROLE_COLORS[key] : 'var(--text-muted)'
}

export default function AgentsPage() {
  const { agents, loading, error } = useAgents()
  const executors    = agents.filter(a => a.role.toLowerCase().includes('executor'))
  const nonExecutors = agents.filter(a => !a.role.toLowerCase().includes('executor'))

  return (
    <div className="agents-page">
      <nav className="agents-page__nav">
        <div className="agents-page__nav-brand">
          <span className="agents-page__nav-logo">#</span>
          <span className="agents-page__nav-name">ZaZaPay</span>
        </div>
        <div className="agents-page__nav-links">
          <Link to="/" className="agents-page__nav-link">Dashboard</Link>
          <Link to="/history" className="agents-page__nav-link">History</Link>
          <Link to="/agents" className="agents-page__nav-link agents-page__nav-link--active">Agents</Link>
        </div>
      </nav>

      <div className="agents-page__body">
        <div className="agents-page__header">
          <h1 className="agents-page__title">Agent Registry</h1>
          <p className="agents-page__sub">All registered agents on Somnia testnet</p>
        </div>

        <div className="agents-page__stats">
          <div className="agents-page__stat">
            <span className="agents-page__stat-val">{agents.length}</span>
            <span className="agents-page__stat-label">Total Agents</span>
          </div>
          <div className="agents-page__stat">
            <span className="agents-page__stat-val" style={{ color: 'var(--accent-green)' }}>{agents.filter(a => a.active).length}</span>
            <span className="agents-page__stat-label">Active</span>
          </div>
          <div className="agents-page__stat">
            <span className="agents-page__stat-val" style={{ color: 'var(--accent-cyan)' }}>{executors.length}</span>
            <span className="agents-page__stat-label">Executors</span>
          </div>
          <div className="agents-page__stat">
            <span className="agents-page__stat-val" style={{ color: 'var(--accent-amber)' }}>{agents.reduce((s, a) => s + a.successCount, 0)}</span>
            <span className="agents-page__stat-label">Total Settlements</span>
          </div>
        </div>

        {loading && agents.length === 0 && (
          <div className="agents-page__loading">
            <span className="agents-page__spinner" />
            Fetching registry...
          </div>
        )}

        {error && <div className="agents-page__error">{error}</div>}

        {executors.length > 0 && (
          <>
            <div className="agents-page__section-label">Executor Agents</div>
            <div className="agents-page__executor-grid">
              {executors.map((agent, i) => (
                <motion.div key={agent.address} className="agents-page__executor-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <div className="agents-page__executor-top">
                    <span className="agents-page__executor-name">{agent.name}</span>
                    <span className={`agents-page__status-pill ${agent.active ? 'agents-page__status-pill--active' : ''}`}>
                      {agent.active ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                  </div>
                  <a className="agents-page__addr mono" href={explorerAddress(agent.address)} target="_blank" rel="noreferrer">{truncateAddr(agent.address, 12, 8)}</a>
                  <div className="agents-page__perf">
                    <div className="agents-page__perf-item">
                      <span className="agents-page__perf-label">Settlements</span>
                      <span className="agents-page__perf-val" style={{ color: 'var(--accent-green)' }}>{agent.successCount}</span>
                    </div>
                    <div className="agents-page__perf-item">
                      <span className="agents-page__perf-label">Failures</span>
                      <span className="agents-page__perf-val" style={{ color: 'var(--accent-red)' }}>{agent.failCount}</span>
                    </div>
                    <div className="agents-page__perf-item">
                      <span className="agents-page__perf-label">Win rate</span>
                      <span className="agents-page__perf-val">
                        {agent.successCount + agent.failCount > 0 ? `${Math.round((agent.successCount / (agent.successCount + agent.failCount)) * 100)}%` : '--'}
                      </span>
                    </div>
                  </div>
                  {agent.lastSeen && <span className="agents-page__last-seen">Last seen {formatTimestamp(agent.lastSeen)}</span>}
                </motion.div>
              ))}
            </div>
          </>
        )}

        {agents.length > 0 && (
          <>
            <div className="agents-page__section-label">All Agents</div>
            <div className="agents-page__table-wrap">
              <table className="agents-page__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {[...executors, ...nonExecutors].map((agent, i) => (
                    <motion.tr key={agent.address} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                      <td className="agents-page__td-name">{agent.name}</td>
                      <td>
                        <span className="agents-page__role-chip" style={{ color: roleColor(agent.role), borderColor: roleColor(agent.role) + '44', background: roleColor(agent.role) + '11' }}>
                          {agent.role}
                        </span>
                      </td>
                      <td><a className="agents-page__addr-link mono" href={explorerAddress(agent.address)} target="_blank" rel="noreferrer">{truncateAddr(agent.address)}</a></td>
                      <td>
                        <span className={`agents-page__status-pill ${agent.active ? 'agents-page__status-pill--active' : ''}`}>
                          {agent.active ? 'ACTIVE' : 'OFFLINE'}
                        </span>
                      </td>
                      <td className="agents-page__td-green">{agent.successCount}</td>
                      <td className="agents-page__td-red">{agent.failCount}</td>
                      <td className="agents-page__td-muted">{agent.lastSeen ? formatTimestamp(agent.lastSeen) : '--'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
