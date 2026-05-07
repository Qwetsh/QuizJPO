import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import Print from './pages/Print'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/classement" element={<Leaderboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/imprimer" element={<Print />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
