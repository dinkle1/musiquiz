import { useState, useEffect } from 'react'
import { fetchPlaylistTracks, fetchPlaylists } from '../utils/spotify.js'
import { fetchPreviewUrl } from '../utils/itunes.js'
import { createLobby, joinLobby, getPlayerId, getPlayerName, setPlayerName } from '../utils/lobby.js'

export default function Lobby({ token, joinOnly = false, onLobbyReady, onBack }) {
  const [tab, setTab]                   = useState(joinOnly ? 'join' : 'create')
  const [name, setName]                 = useState(getPlayerName())
  const [joinCode, setJoinCode]         = useState('')
  const [playlists, setPlaylists]       = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [step, setStep]                 = useState('setup')
  const [error, setError]               = useState(null)
  const [loadingMsg, setLoadingMsg]     = useState('')

  useEffect(() => {
    if (joinOnly || !token) return
    fetchPlaylists(token).then(setPlaylists).catch(() => {})
  }, [token, joinOnly])

  async function handleCreate() {
    if (!name.trim() || !selectedPlaylist) return
    setPlayerName(name.trim())
    setStep('loading')
    setError(null)
    try {
      setLoadingMsg('Loading tracks…')
      const tracks = await fetchPlaylistTracks(token, selectedPlaylist.id)
      if (tracks.length === 0) { setError('Playlist has no tracks.'); setStep('setup'); return }

      const shuffled = shuffle(tracks).slice(0, 20)
      setLoadingMsg(`Fetching previews (0/${shuffled.length})…`)
      const previewUrls = {}
      for (let i = 0; i < shuffled.length; i++) {
        const t = shuffled[i]
        const url = await fetchPreviewUrl(t.name, t.artists[0]?.name || '')
        previewUrls[t.id] = url || ''
        setLoadingMsg(`Fetching previews (${i + 1}/${shuffled.length})…`)
      }

      const songList = shuffled
        .filter(t => previewUrls[t.id])
        .map(t => ({
          id:         t.id,
          title:      t.name,
          artist:     t.artists.map(a => a.name).join(', '),
          albumArt:   t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
          previewUrl: previewUrls[t.id],
        }))

      if (songList.length === 0) { setError('No previewable tracks found.'); setStep('setup'); return }

      setLoadingMsg('Creating lobby…')
      const playerId = getPlayerId()
      const { code } = await createLobby({
        hostId: playerId, hostName: name.trim(),
        playlistName: selectedPlaylist.name, songList,
      })
      onLobbyReady({ code, role: 'host', playerId, playerName: name.trim() })
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setStep('setup')
    }
  }

  async function handleJoin() {
    if (!name.trim() || joinCode.trim().length < 4) return
    setPlayerName(name.trim())
    setStep('loading')
    setLoadingMsg('Joining lobby…')
    setError(null)
    try {
      const playerId = getPlayerId()
      await joinLobby(joinCode.trim().toUpperCase(), { guestId: playerId, guestName: name.trim() })
      onLobbyReady({ code: joinCode.trim().toUpperCase(), role: 'guest', playerId, playerName: name.trim() })
    } catch (e) {
      setError(e.message || 'Could not join lobby.')
      setStep('setup')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
        <div className="w-10 h-10 border-2 border-[var(--green)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{loadingMsg}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-md mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn-icon p-2 rounded-lg"
                  style={{ background: 'var(--bg-card)' }} aria-label="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight">1v1 Battle</h1>
        </div>

        {!joinOnly && (
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
            {['create', 'join'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded text-sm font-bold cursor-pointer transition-all duration-200"
                style={{
                  background: tab === t ? 'var(--bg-hover)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--muted)',
                }}>
                {t === 'create' ? 'Create Lobby' : 'Join Lobby'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg p-3 text-xs text-red-400"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Your name</label>
          <input type="text" maxLength={20} value={name}
            onChange={e => setName(e.target.value)} placeholder="Enter your name…"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--green)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {tab === 'create' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Pick a playlist</label>
              {playlists.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>Loading playlists…</p>
              ) : (
                <div className="space-y-0.5 max-h-64 overflow-y-auto no-scrollbar rounded-lg"
                     style={{ border: '1px solid var(--border)' }}>
                  {playlists.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlaylist(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-left"
                      style={{
                        background: selectedPlaylist?.id === p.id ? 'var(--bg-hover)' : 'var(--bg-card)',
                        borderLeft: `2px solid ${selectedPlaylist?.id === p.id ? 'var(--green)' : 'transparent'}`,
                      }}>
                      {p.images?.[0]?.url && (
                        <img src={p.images[0].url} alt="" className="w-9 h-9 object-cover flex-shrink-0"
                             style={{ borderRadius: '4px' }} />
                      )}
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{p.name}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.tracks?.total ?? 0} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleCreate}
              disabled={!name.trim() || !selectedPlaylist}
              className="btn-primary w-full justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
              Create Lobby
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Lobby code</label>
              <input type="text" value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full rounded-lg px-4 py-4 text-center text-2xl font-black tracking-widest outline-none"
                style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button onClick={handleJoin}
              disabled={!name.trim() || joinCode.trim().length < 4}
              className="btn-primary w-full justify-center py-3 disabled:opacity-40">
              Join Lobby →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
