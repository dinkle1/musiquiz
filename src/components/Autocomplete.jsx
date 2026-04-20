import { useState, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'

export default function Autocomplete({ songs, onSelect, disabled, placeholder = 'Search for a song…' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const fuseRef = useRef(null)

  useEffect(() => {
    fuseRef.current = new Fuse(songs, {
      keys: ['title', 'artist'],
      threshold: 0.4,
      includeScore: true,
    })
  }, [songs])

  // Reset query only on mount (when key changes externally to signal a new round)
  useEffect(() => {
    setQuery('')
    setResults([])
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)

    if (!val.trim()) { setResults([]); setOpen(false); return }

    const hits = fuseRef.current.search(val).slice(0, 6).map(r => r.item)
    setResults(hits)
    setOpen(hits.length > 0)
    setHighlighted(0)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h+1, results.length-1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h-1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[highlighted]) pick(results[highlighted]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  function pick(song) {
    setQuery(`${song.title} — ${song.artist}`)
    setOpen(false)
    onSelect(song)
  }

  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={e => { if (query && results.length) setOpen(true); e.target.style.borderColor = 'var(--neon)'; e.target.style.boxShadow = '0 0 12px rgba(0,255,135,0.2)' }}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all duration-200"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--text)',
          fontFamily: 'Poppins, sans-serif',
        }}
        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
      />

      {open && (
        <ul
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-2)', border: '1px solid rgba(0,255,135,0.25)' }}
        >
          {results.map((song, i) => (
            <li
              key={song.id}
              onMouseDown={() => pick(song)}
              onMouseEnter={() => setHighlighted(i)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100"
              style={{
                background: i === highlighted ? 'rgba(0,255,135,0.1)' : 'transparent',
                borderLeft: i === highlighted ? '2px solid var(--neon)' : '2px solid transparent',
              }}
            >
              {song.albumArt && (
                <img src={song.albumArt} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{song.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
