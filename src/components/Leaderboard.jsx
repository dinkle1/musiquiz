import { useState, useEffect } from 'react'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Leaderboard({ onBack, pendingScore = null, totalSongs = 0 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
  const resetTime = new Date(now.toLocaleDateString('en-US', { timeZone: 'America/New_York' }) + ' 12:00:00 AM')

  return (
    <div className="min-h-screen grid-bg px-4 py-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="text-[var(--muted)] hover:text-white transition-colors cursor-pointer p-2 rounded-lg"
            style={{ background: 'var(--bg-2)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-3xl text-[var(--purple)] neon-text-purple" style={{ fontFamily: 'Righteous' }}>
              🏆 Daily Leaderboard
            </h1>
            <p className="text-[var(--muted)] text-xs mt-0.5">
              Resets at midnight EST · {now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Submit score */}
        {pendingScore !== null && !submitted && (
          <div className="rounded-2xl p-5 space-y-4 slide-up"
               style={{ background: 'var(--bg-2)', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 0 30px rgba(168,85,247,0.1)' }}>
            <div className="text-center">
              <div className="text-5xl font-black" style={{ fontFamily: 'Righteous', color: 'var(--purple)' }}>
                {pendingScore} pts
              </div>
              <p className="text-[var(--muted)] text-sm mt-1">Post your score to the leaderboard</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Your name…"
                value={username}
                maxLength={24}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--bg-3)', color: 'var(--text)', border: '1px solid rgba(168,85,247,0.3)' }}
                onFocus={e => e.target.style.borderColor = 'var(--purple)'}
                onBlur={e => e.target.style.borderColor = 'rgba(168,85,247,0.3)'}
              />
              <button
                onClick={handleSubmit}
                disabled={!username.trim() || submitting}
                className="px-5 py-3 rounded-xl font-bold text-white cursor-pointer transition-all disabled:opacity-40"
                style={{ background: 'var(--purple)', fontFamily: 'Righteous' }}
              >
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {submitted && (
          <div className="rounded-2xl p-4 text-center text-sm slide-up"
               style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: 'var(--purple)' }}>
            Score posted! Good luck 🎉
          </div>
        )}

        {/* Leaderboard table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--purple)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-red-400 py-8">{error}</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <p className="text-4xl">🎵</p>
            <p className="text-[var(--muted)]">No scores yet today. Be the first!</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {entries.map((entry, i) => {
              const isMe = entry.username === username && submitted && i === entries.findIndex(e => e.username === username && e.score === pendingScore)
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isMe ? 'rgba(168,85,247,0.1)' : 'transparent',
                  }}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-lg">{MEDAL[i]}</span>
                    ) : (
                      <span className="text-[var(--muted)] text-sm font-bold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{entry.username}</p>
                    <p className="text-[var(--muted)] text-xs">{entry.totalSongs} songs</p>
                  </div>
                  <div
                    className="text-lg font-black flex-shrink-0"
                    style={{ fontFamily: 'Righteous', color: i === 0 ? '#f59e0b' : 'var(--purple)' }}
                  >
                    {entry.score}
                    <span className="text-xs font-normal ml-0.5" style={{ color: 'var(--muted)' }}>pts</span>
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
