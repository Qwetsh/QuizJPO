import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { isMobileDevice } from '../lib/isMobile'
import { defaultQuestions } from '../lib/defaultQuestions'

export default function Admin() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (isMobileDevice()) {
    return (
      <div className="container">
        <h1>Accès non autorisé</h1>
        <p>La page d'administration n'est accessible que depuis un ordinateur.</p>
        <Link to="/" className="link-button">← Retour</Link>
      </div>
    )
  }

  if (!authChecked) {
    return <div className="container"><p className="muted">Chargement…</p></div>
  }

  if (!session) return <AdminLogin />

  return <AdminPanel email={session.user.email} onLogout={() => supabase.auth.signOut()} />
}

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) {
      console.error(e)
      setError('Identifiants invalides.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Administration</h1>
      <form onSubmit={submit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          required
        />
        <button type="submit" className="primary" disabled={loading}>
          {loading ? '…' : 'Se connecter'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function AdminPanel({ email, onLogout }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | question | 'new'
  const [seeding, setSeeding] = useState(false)
  const [showQrFor, setShowQrFor] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('quiz_jpo_questions')
        .select('*')
        .order('display_order')
      if (error) throw error
      setQuestions(data || [])
    } catch (e) {
      console.error(e)
      setError('Impossible de charger les questions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!window.confirm(`Supprimer la question "${id}" ?`)) return
    try {
      const { error } = await supabase.from('quiz_jpo_questions').delete().eq('id', id)
      if (error) throw error
      load()
    } catch (e) {
      console.error(e)
      setError('Suppression impossible.')
    }
  }

  async function seedDefaults() {
    if (!window.confirm(`Cela va créer/écraser ${defaultQuestions.length} questions par défaut. Continuer ?`)) return
    setSeeding(true)
    try {
      const { error } = await supabase
        .from('quiz_jpo_questions')
        .upsert(defaultQuestions, { onConflict: 'id' })
      if (error) throw error
      await load()
    } catch (e) {
      console.error(e)
      setError('Erreur lors du chargement des questions par défaut.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="container admin">
      <header className="topbar">
        <h1>Administration</h1>
        <div className="row gap">
          <span className="muted">{email}</span>
          <button onClick={onLogout}>Déconnexion</button>
        </div>
      </header>

      <div className="row gap">
        <button className="primary" onClick={() => setEditing('new')}>+ Nouvelle question</button>
        <button onClick={seedDefaults} disabled={seeding}>
          {seeding ? '…' : 'Charger les questions par défaut'}
        </button>
        <Link to="/classement" className="link-button">🏆 Classement</Link>
        <Link to="/" className="link-button">Quiz</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {editing && (
        <QuestionEditor
          question={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}

      {showQrFor && (
        <QrModal question={showQrFor} onClose={() => setShowQrFor(null)} />
      )}

      {loading ? <p className="muted">Chargement…</p> : (
        <table className="questions-table">
          <thead>
            <tr>
              <th>#</th>
              <th>ID (slug)</th>
              <th>Nom interne</th>
              <th>Question</th>
              <th>Bonne réponse</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td>{q.display_order}</td>
                <td><code>{q.id}</code></td>
                <td>{q.name}</td>
                <td>{q.prompt}</td>
                <td>{q.correct_answer}</td>
                <td className="row gap">
                  <button onClick={() => setEditing(q)}>Éditer</button>
                  <button onClick={() => setShowQrFor(q)}>QR</button>
                  <button className="danger" onClick={() => remove(q.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr><td colSpan="6" className="muted">Aucune question. Crées-en une ou charge celles par défaut.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

function QuestionEditor({ question, onClose, onSaved }) {
  const isNew = !question
  const [id, setId] = useState(question?.id || '')
  const [name, setName] = useState(question?.name || '')
  const [prompt, setPrompt] = useState(question?.prompt || 'À quelle espèce appartient ce crâne ?')
  const initialChoices = question?.choices?.length === 4 ? question.choices : ['', '', '', '']
  const [choices, setChoices] = useState(initialChoices)
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || '')
  const [order, setOrder] = useState(question?.display_order ?? 0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.preventDefault()
    setError('')

    if (!/^[a-z0-9-]{2,40}$/.test(id)) {
      setError('L\'ID doit contenir 2 à 40 caractères : lettres minuscules, chiffres ou tirets.')
      return
    }
    const trimmedChoices = choices.map((c) => c.trim())
    if (trimmedChoices.some((c) => !c)) {
      setError('Toutes les réponses doivent être remplies.')
      return
    }
    if (new Set(trimmedChoices).size !== trimmedChoices.length) {
      setError('Les réponses doivent être différentes les unes des autres.')
      return
    }
    if (!trimmedChoices.includes(correctAnswer)) {
      setError('La bonne réponse doit faire partie des choix.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('quiz_jpo_questions')
        .upsert({
          id,
          name: name.trim(),
          prompt: prompt.trim(),
          choices: trimmedChoices,
          correct_answer: correctAnswer.trim(),
          display_order: Number(order) || 0,
        }, { onConflict: 'id' })
      if (error) throw error
      onSaved()
    } catch (e) {
      console.error(e)
      setError('Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{isNew ? 'Nouvelle question' : `Édition : ${id}`}</h2>

        <label>
          ID (slug, dans l'URL du QR code)
          <input
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            disabled={!isNew}
            placeholder="crane-cheval"
            required
          />
        </label>

        <label>
          Nom interne (ce qui sera affiché à l'élève après sa réponse)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crâne de cheval"
            required
          />
        </label>

        <label>
          Question affichée
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
        </label>

        <fieldset>
          <legend>Réponses (4 choix)</legend>
          {choices.map((c, i) => (
            <input
              key={i}
              value={c}
              onChange={(e) => setChoices(choices.map((cc, j) => (j === i ? e.target.value : cc)))}
              placeholder={`Choix ${i + 1}`}
              required
            />
          ))}
        </fieldset>

        <label>
          Bonne réponse
          <select
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            required
          >
            <option value="">— sélectionner —</option>
            {choices.filter((c) => c.trim()).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          Ordre d'affichage (admin uniquement)
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="row gap right">
          <button type="button" onClick={onClose}>Annuler</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function QrModal({ question, onClose }) {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}?q=${question.id}`

  function printQr() {
    window.print()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{question.name}</h2>
        <div className="qr-print">
          <QRCodeSVG value={url} size={280} includeMargin />
          <p className="qr-label">{question.name}</p>
        </div>
        <p className="muted"><code>{url}</code></p>
        <div className="row gap right no-print">
          <button onClick={printQr}>Imprimer</button>
          <button className="primary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
