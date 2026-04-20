import { useState, useEffect } from 'react'
import { fetchPlaylistTracks, fetchPlaylists } from '../utils/spotify.js'
import { fetchPreviewUrl } from '../utils/itunes.js'
import { createLobby, joinLobby, getPlayerId, getPlayerName, setPlayerName } from '../utils/lobby.js'

export default function Lobby({ token, joinOnly = false, onLobbyReady, onBack }) {
  const [tab, setTab] = useState(joinOnly ? 'join' : 'create') // 'create' | 'join'
  const [name, setName] = useState(getPlayerName())
  const [joinCode, setJoinCode] = useState('')
  const [playlists, setPlaylists] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)
  const [step, setStep] = useState('setup') // 'setup' | 'loading' | 'done'
  const [error, setError] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')

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

      const shuffled = shuffle(tracks).slice(0, 20) // cap at 20 songs for 1v1

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
          id: t.id,
          title: t.name,
          artist: t.artists.map(a => a.name).join(', '),
          albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url || '',
          previewUrl: previewUrls[t.id],
        }))

      if (songList.length === 0) { setError('No previewable tracks found.'); setStep('setup'); return }

      setLoadingMsg('Creating lobby…')
      const playerId = getPlayerId()
      const { code } = await createLobby({
        hostId: playerId,
        hostName: name.trim(),
        playlistName: selectedPlaylist.name,
        songList,
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
      await joinLobby(joinCode.trim().toUpperCase(), {
        guestId: playerId,
        guestName: name.trim(),
      })
      onLobbyReady({ code: joinCode.trim().toUpperCase(), role: 'guest', playerId, playerName: name.trim() })
    } catch (e) {
      setError(e.message || 'Could not join lobby.')
      setStep('setup')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen grid-bg flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-2 border-[var(--pink)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--muted)] text-sm">{loadingMsg}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid-bg px-4 py-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="text-[var(--muted)] hover:text-white cursor-pointer p-2 rounded-lg transition-colors"
            style={{ background: 'var(--bg-2)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="text-3xl" style={{ fontFamily: 'Righteous', color: 'var(--pink)', textShadow: '0 0 20px rgba(244,114,182,0.5)' }}>
            ⚔ 1v1 Battle
          </h1>
        </div>

        {/* Tabs */}
        {!joinOnly && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl" style={{ background: 'var(--bg-2)' }}>
            {['create', 'join'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
                style={{
                  fontFamily: 'Righteous',
                  background: tab === t ? 'var(--bg-3)' : 'transparent',
                  color: tab === t ? 'var(--pink)' : 'var(--muted)',
                  boxShadow: tab === t ? '0 0 16px rgba(244,114,182,0.15)' : 'none',
                }}>
                {t === 'create' ? '⚡ Create Lobby' : '🔗 Join Lobby'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 text-sm text-red-400"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        {/* Name input — shared */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Your name</label>
          <input
            type="text" maxLength={20} value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name…"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--bg-2)', color: 'var(--text)', border: '1px solid rgba(244,114,182,0.25)' }}
            onFocus={e => e.target.style.borderColor = 'var(--pink)'}
            onBlur={e => e.target.style.borderColor = 'rgba(244,114,182,0.25)'}
          />
        </div>

        {tab === 'create' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Pick a playlist</label>
              {playlists.length === 0 ? (
                <p className="text-[var(--muted)] text-sm py-4 text-center">Loading playlists…</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar rounded-xl"
                     style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  {playlists.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlaylist(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
                      style={{
                        background: selectedPlaylist?.id === p.id ? 'rgba(244,114,182,0.1)' : 'var(--bg-2)',
                        borderLeft: selectedPlaylist?.id === p.id ? '2px solid var(--pink)' : '2px solid transparent',
                      }}>
                      {p.images?.[0]?.url && (
                        <img src={p.images[0].url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 text-left">
                        <p className="text-white text-sm truncate">{p.name}</p>
                        <p className="text-[var(--muted)] text-xs">{p.tracks?.total ?? 0} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={!name.trim() || !selectedPlaylist}
              className="w-full py-3 rounded-xl font-bold text-black cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--pink)', fontFamily: 'Righteous', boxShadow: '0 0 20px rgba(244,114,182,0.3)' }}
            >
              Create Lobby ⚡
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wider">Lobby code</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest outline-none"
                style={{ background: 'var(--bg-2)', color: 'var(--pink)', border: '1px solid rgba(244,114,182,0.25)', fontFamily: 'Righteous' }}
                onFocus={e => e.target.style.borderColor = 'var(--pink)'}
                onBlur={e => e.target.style.borderColor = 'rgba(244,114,182,0.25)'}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={!name.trim() || joinCode.trim().length < 4}
              className="w-full py-3 rounded-xl font-bold text-black cursor-pointer transition-all disabled:opacity-40"
              style={{ background: 'var(--pink)', fontFamily: 'Righteous' }}
            >
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
