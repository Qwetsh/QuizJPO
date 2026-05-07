import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase, getOrCreateLocalParticipantId } from '../lib/supabase'

export default function Home() {
  const [searchParams] = useSearchParams()
  const questionId = searchParams.get('q')

  const [participantId] = useState(() => getOrCreateLocalParticipantId())
  const [participantData, setParticipantData] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const [pseudo, setPseudo] = useState('')
  const [savingPseudo, setSavingPseudo] = useState(false)

  const [question, setQuestion] = useState(null)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [justAnswered, setJustAnswered] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_jpo_participants')
          .select('pseudo, score, answered')
          .eq('id', participantId)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (data) setParticipantData(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Connexion impossible. Vérifie ta connexion internet.')
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [participantId])

  useEffect(() => {
    if (!questionId || !ready) return
    let cancelled = false
    setLoadingQuestion(true)
    setQuestion(null)
    setSelectedAnswer(null)
    setJustAnswered(null)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_jpo_questions')
          .select('*')
          .eq('id', questionId)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (data) {
          setQuestion(data)
        } else {
          setError('Cette question n\'existe pas. Vérifie le QR code.')
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Impossible de charger la question.')
      } finally {
        if (!cancelled) setLoadingQuestion(false)
      }
    })()
    return () => { cancelled = true }
  }, [questionId, ready])

  async function submitPseudo(e) {
    e.preventDefault()
    setError('')
    const trimmed = pseudo.trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('Votre pseudo doit faire entre 2 et 20 caractères.')
      return
    }
    setSavingPseudo(true)
    try {
      const { error } = await supabase
        .from('quiz_jpo_participants')
        .insert({ id: participantId, pseudo: trimmed })
      if (error) throw error
      setParticipantData({ pseudo: trimmed, score: 0, answered: {} })
    } catch (e) {
      console.error(e)
      setError('Impossible d\'enregistrer le pseudo.')
    } finally {
      setSavingPseudo(false)
    }
  }

  async function submitAnswer() {
    if (!question || selectedAnswer === null) return
    setSubmitting(true)
    setError('')
    try {
      const isCorrect = selectedAnswer === question.correct_answer
      const newAnswered = { ...(participantData.answered || {}), [question.id]: isCorrect }
      const newScore = (participantData.score || 0) + (isCorrect ? 1 : 0)
      const { error } = await supabase
        .from('quiz_jpo_participants')
        .update({ score: newScore, answered: newAnswered })
        .eq('id', participantId)
      if (error) throw error
      setParticipantData({ ...participantData, answered: newAnswered, score: newScore })
      setJustAnswered({ correct: isCorrect, chosen: selectedAnswer })
    } catch (e) {
      console.error(e)
      setError('Impossible d\'enregistrer la réponse. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return <div className="container"><p className="muted">Chargement…</p></div>
  }

  const Header = () => participantData && (
    <header className="topbar">
      <span className="pseudo">👤 {participantData.pseudo}</span>
      <span className="score">⭐ {participantData.score}</span>
    </header>
  )

  if (!participantData) {
    return (
      <div className="container">
        <h1>Bienvenue !</h1>
        <p>Choisissez un pseudo pour commencer le quiz de la JPO.</p>
        <form onSubmit={submitPseudo}>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Votre pseudo"
            maxLength={20}
            autoFocus
            required
          />
          <button type="submit" className="primary" disabled={savingPseudo}>
            {savingPseudo ? 'Enregistrement…' : 'C\'est parti !'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  if (!questionId) {
    return (
      <div className="container">
        <Header />
        <h1>À vous de jouer !</h1>
        <p>Scannez un QR code à côté d'un objet pour répondre à une question.</p>
        <p className="muted">Votre score augmente d'un point par bonne réponse.</p>
        <Link to="/classement" className="link-button">🏆 Voir le classement</Link>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  if (loadingQuestion) {
    return (
      <div className="container">
        <Header />
        <p className="muted">Chargement de la question…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <Header />
        <p className="error">{error}</p>
        <Link to="/" className="link-button">Retour à l'accueil</Link>
      </div>
    )
  }

  if (!question) return null

  const previousAnswer = participantData.answered?.[question.id]
  const alreadyAnsweredBefore = previousAnswer !== undefined && !justAnswered

  if (alreadyAnsweredBefore) {
    return (
      <div className="container">
        <Header />
        <h2>Vous avez déjà répondu à cette question</h2>
        <p className={previousAnswer ? 'correct' : 'incorrect'}>
          {previousAnswer ? '✓ Vous aviez trouvé la bonne réponse !' : '✗ Vous n\'aviez pas trouvé.'}
        </p>
        <p>C'était : <strong>{question.name}</strong> ({question.correct_answer})</p>
        <p className="muted">Scannez un autre QR code pour continuer.</p>
        <Link to="/classement" className="link-button">🏆 Voir le classement</Link>
      </div>
    )
  }

  if (justAnswered) {
    return (
      <div className="container">
        <Header />
        <h2 className={justAnswered.correct ? 'correct' : 'incorrect'}>
          {justAnswered.correct ? '🎉 Bonne réponse !' : '❌ Mauvaise réponse'}
        </h2>
        <p>C'était : <strong>{question.name}</strong> ({question.correct_answer})</p>
        {!justAnswered.correct && (
          <p className="muted">Vous aviez répondu : {justAnswered.chosen}</p>
        )}
        <p className="muted">Scannez un autre QR code pour continuer.</p>
        <Link to="/classement" className="link-button">🏆 Voir le classement</Link>
      </div>
    )
  }

  return (
    <div className="container">
      <Header />
      <h2>{question.prompt}</h2>
      <div className="choices">
        {question.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={`choice ${selectedAnswer === choice ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
      <button
        className="primary submit"
        onClick={submitAnswer}
        disabled={selectedAnswer === null || submitting}
      >
        {submitting ? 'Envoi…' : 'Valider'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
