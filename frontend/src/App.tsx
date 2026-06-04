import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard/Dashboard'
import History from './pages/History/History'
import AgentsPage from './pages/Agents/Agents'
import './App.css'

export default function App() {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/agents" element={<AgentsPage />} />
      </Routes>
    </div>
  )
}
