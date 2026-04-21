import { useState, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'

export default function Autocomplete({ songs, onSelect, disabled, placeholder = 'Search for a song…' }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [open, setOpen]             = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef    = useRef(null)
  const containerRef = useRef(null)
  const fuseRef     = useRef(null)

  useEffect(() => {
    fuseRef.current = new Fuse(songs, { keys: ['title', 'artist'], threshold: 0.4, includeScore: true })
  }, [songs])

  useEffect(() => {
    setQuery(''); setResults([]); setOpen(false)
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
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); if (results[highlighted]) pick(results[highlighted]) }
    else if (e.key === 'Escape')    setOpen(false)
  }

  function pick(song) {
    setQuery(`${song.title}${song.artist ? ` — ${song.artist}` : ''}`)
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
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
             style={{ color: 'var(--muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query && results.length) setOpen(true) }}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="sp-input pl-10 py-3"
        />
      </div>

      {open && (
        <ul className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl"
            style={{ background: '#242424', border: '1px solid var(--border)' }}>
          {results.map((song, i) => (
            <li key={song.id}
              onMouseDown={() => pick(song)}
              onMouseEnter={() => setHighlighted(i)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-100"
              style={{ background: i === highlighted ? 'var(--bg-hover)' : 'transparent' }}>
              {song.albumArt && (
                <img src={song.albumArt} alt=""
                  className="w-8 h-8 object-cover flex-shrink-0" style={{ borderRadius: '4px' }} />
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                {song.artist && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{song.artist}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
