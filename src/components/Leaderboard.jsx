import { useState, useEffect } from 'react'

export default function Leaderboard({ onBack, pendingScore = null, totalSongs = 0 }) {
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [username, setUsername]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    fetch('/.netlify/functions/leaderboard')
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError('Could not load leaderboard.'); setLoading(false) })
  }, [submitted])

  async function handleSubmit() {
    if (!username.trim() || pendingScore === null) return
    setSubmitting(true)
    try {
      await fetch('/.netlify/functions/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), score: pendingScore, totalSongs }),
      })
      setSubmitted(true)
      localStorage.setItem('clipd_daily', JSON.stringify({
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
        score: pendingScore, totalSongs, submitted: true,
      }))
    } catch { setError('Failed to submit score.') }
    setSubmitting(false)
  }

  const now = new Date()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn-icon p-2 rounded-lg"
                  style={{ background: 'var(--bg-card)' }} aria-label="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Daily Leaderboard</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Resets midnight EST ·{' '}
              {now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Submit score */}
        {pendingScore !== null && !submitted && (
          <div className="rounded-lg p-5 space-y-4 slide-up"
               style={{ background: 'var(--bg-card)', border: '1px solid rgba(29,185,84,0.3)' }}>
            <div className="text-center">
              <div className="text-5xl font-black text-white tracking-tight">{pendingScore}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>points</p>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Your name…" value={username}
                maxLength={24} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button onClick={handleSubmit}
                disabled={!username.trim() || submitting}
                className="btn-primary px-5 py-3 text-sm disabled:opacity-40">
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {submitted && (
          <div className="rounded-lg p-4 text-center text-sm slide-up"
               style={{ background: 'rgba(29,185,84,0.1)', border: '1px solid rgba(29,185,84,0.3)', color: 'var(--green)' }}>
            Score posted! Good luck.
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-400 text-sm py-8">{error}</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-3xl">🎵</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No scores yet today. Be the first!</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {entries.map((entry, i) => {
              const isMe = entry.username === username && submitted &&
                i === entries.findIndex(e => e.username === username && e.score === pendingScore)
              const medal = ['🥇', '🥈', '🥉'][i]
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 transition-colors"
                     style={{
                       borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                       background: isMe ? 'rgba(29,185,84,0.08)' : 'transparent',
                     }}>
                  <div className="w-8 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-base">{medal}</span>
                    ) : (
                      <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{entry.username}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{entry.totalSongs} songs</p>
                  </div>
                  <div className="text-lg font-black flex-shrink-0 text-white">
                    {entry.score}
                    <span className="text-xs font-normal ml-1" style={{ color: 'var(--muted)' }}>pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
