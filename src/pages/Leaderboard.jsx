import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { db } from '../lib/firebase'

export default function Leaderboard() {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const q = query(collection(db, 'participants'), orderBy('score', 'desc'), limit(100))
        const snap = await getDocs(q)
        if (cancelled) return
        setParticipants(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Impossible de charger le classement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="container">
      <h1>🏆 Classement</h1>
      {loading && <p className="muted">Chargement…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && participants.length === 0 && (
        <p className="muted">Personne n'a encore joué.</p>
      )}
      {!loading && participants.length > 0 && (
        <ol className="leaderboard">
          {participants.map((p, i) => (
            <li key={p.id} className={i < 3 ? `top top-${i + 1}` : ''}>
              <span className="rank">{i + 1}</span>
              <span className="pseudo">{p.pseudo}</span>
              <span className="score">{p.score ?? 0}</span>
            </li>
          ))}
        </ol>
      )}
      <Link to="/" className="link-button">← Retour</Link>
    </div>
  )
}
