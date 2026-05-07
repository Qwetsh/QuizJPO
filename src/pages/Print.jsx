import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { isMobileDevice } from '../lib/isMobile'

const CATEGORY_EMOJI = {
  'Microscope': '🔬',
  'Ostéologie': '🦴',
  'Paléontologie': '🪨',
}

function emojiFor(category) {
  return CATEGORY_EMOJI[category] || '📌'
}

export default function Print() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_jpo_questions')
          .select('id, name, category, display_order')
          .order('display_order')
        if (cancelled) return
        if (error) throw error
        setQuestions(data || [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Impossible de charger les questions.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [session])

  if (isMobileDevice()) {
    return (
      <div className="container">
        <h1>Accès non autorisé</h1>
        <p>Cette page n'est accessible que depuis un ordinateur.</p>
        <Link to="/" className="link-button">← Retour</Link>
      </div>
    )
  }

  if (!authChecked) return <div className="container"><p className="muted">Chargement…</p></div>

  if (!session) {
    return (
      <div className="container">
        <h1>Connexion requise</h1>
        <p>Connecte-toi via la page d'administration pour générer les QR codes.</p>
        <Link to="/admin" className="link-button">→ Aller à l'administration</Link>
      </div>
    )
  }

  if (loading) return <div className="container"><p className="muted">Chargement des questions…</p></div>
  if (error) return <div className="container"><p className="error">{error}</p></div>

  if (questions.length === 0) {
    return (
      <div className="container">
        <h1>Aucune question</h1>
        <p>Crée d'abord des questions dans l'administration.</p>
        <Link to="/admin" className="link-button">→ Administration</Link>
      </div>
    )
  }

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <div className="row gap">
          <Link to="/admin" className="link-button">← Retour admin</Link>
          <span className="muted">{questions.length} carte{questions.length > 1 ? 's' : ''} à imprimer</span>
        </div>
        <button className="primary" onClick={() => window.print()}>🖨️ Imprimer</button>
      </div>

      <div className="print-sheet">
        {questions.map((q) => {
          const url = `${window.location.origin}${import.meta.env.BASE_URL}?q=${q.id}`
          const cat = q.category || ''
          return (
            <article key={q.id} className="qr-card">
              <header className="qr-card-header">
                <span className="qr-card-emoji">{emojiFor(cat)}</span>
                <span className="qr-card-cat">{cat || 'Quiz'}</span>
                <span className="qr-card-num">#{q.display_order}</span>
              </header>
              <div className="qr-card-body">
                <h2 className="qr-card-title">{q.name}</h2>
                <div className="qr-card-qr">
                  <QRCodeSVG value={url} size={220} includeMargin level="M" />
                </div>
                <p className="qr-card-instruction">
                  📷 Scannez avec votre téléphone pour répondre
                </p>
              </div>
              <footer className="qr-card-footer">
                Quiz JPO · Collège
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
