import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

const PARTICIPANT_KEY = 'quizz-jpo-participant-id'

export function getOrCreateLocalParticipantId() {
  let id = localStorage.getItem(PARTICIPANT_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(PARTICIPANT_KEY, id)
  }
  return id
}
