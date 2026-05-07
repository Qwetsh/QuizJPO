import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Leaderboard() {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_jpo_participants')
          .select('id, pseudo, score')
          .order('score', { ascending: false })
          .order('updated_at', { ascending: true })
          .limit(100)
        if (cancelled) return
        if (error) throw error
        setParticipants(data || [])
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
