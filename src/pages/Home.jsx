import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, ensureAnonymousAuth } from '../lib/firebase'

export default function Home() {
  const [searchParams] = useSearchParams()
  const questionId = searchParams.get('q')

  const [authUser, setAuthUser] = useState(null)
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
    async function init() {
      try {
        const user = await ensureAnonymousAuth()
        if (cancelled) return
        setAuthUser(user)
        const snap = await getDoc(doc(db, 'participants', user.uid))
        if (cancelled) return
        if (snap.exists()) setParticipantData(snap.data())
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Connexion impossible. Vérifie ta connexion internet.')
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!questionId || !ready) return
    let cancelled = false
    setLoadingQuestion(true)
    setQuestion(null)
    setSelectedAnswer(null)
    setJustAnswered(null)
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'questions', questionId))
        if (cancelled) return
        if (snap.exists()) {
          setQuestion({ id: snap.id, ...snap.data() })
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
      setError('Le pseudo doit faire entre 2 et 20 caractères.')
      return
    }
    setSavingPseudo(true)
    try {
      const data = {
        pseudo: trimmed,
        score: 0,
        answered: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'participants', authUser.uid), data)
      setParticipantData(data)
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
      const isCorrect = selectedAnswer === question.correctAnswer
      const newAnswered = { ...(participantData.answered || {}), [question.id]: isCorrect }
      const newScore = (participantData.score || 0) + (isCorrect ? 1 : 0)
      await updateDoc(doc(db, 'participants', authUser.uid), {
        answered: newAnswered,
        score: newScore,
        updatedAt: serverTimestamp(),
      })
      setParticipantData({ ...participantData, answered: newAnswered, score: newScore })
      setJustAnswered({ correct: isCorrect, chosen: selectedAnswer })
    } catch (e) {
      console.error(e)
      setError('Impossible d\'enregistrer la réponse. Réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return <div className="container"><p className="muted">Chargement…</p></div>
  }

  // Bandeau de score commun
  const Header = () => participantData && (
    <header className="topbar">
      <span className="pseudo">👤 {participantData.pseudo}</span>
      <span className="score">⭐ {participantData.score}</span>
    </header>
  )

  // Étape 1 : pseudo manquant
  if (!participantData) {
    return (
      <div className="container">
        <h1>Bienvenue !</h1>
        <p>Choisis un pseudo pour commencer le quiz de la JPO.</p>
        <form onSubmit={submitPseudo}>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ton pseudo"
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

  // Étape 2 : on a un pseudo, mais pas de QR code scanné → écran d'accueil
  if (!questionId) {
    return (
      <div className="container">
        <Header />
        <h1>À toi de jouer !</h1>
        <p>Scanne un QR code à côté d'un objet pour répondre à une question.</p>
        <p className="muted">Ton score augmente d'un point par bonne réponse.</p>
        <Link to="/classement" className="link-button">🏆 Voir le classement</Link>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  // Étape 3 : un QR code a été scanné
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
        <h2>Tu as déjà répondu à cette question</h2>
        <p className={previousAnswer ? 'correct' : 'incorrect'}>
          {previousAnswer ? '✓ Tu avais trouvé la bonne réponse !' : '✗ Tu n\'avais pas trouvé.'}
        </p>
        <p>C'était : <strong>{question.name}</strong> ({question.correctAnswer})</p>
        <p className="muted">Scanne un autre QR code pour continuer.</p>
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
        <p>C'était : <strong>{question.name}</strong> ({question.correctAnswer})</p>
        {!justAnswered.correct && (
          <p className="muted">Tu avais répondu : {justAnswered.chosen}</p>
        )}
        <p className="muted">Scanne un autre QR code pour continuer.</p>
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
