import { useState, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'

export default function Autocomplete({ songs, onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [selected, setSelected] = useState(null)
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

  useEffect(() => {
    setQuery('')
    setSelected(null)
    setResults([])
    setOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [songs])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setSelected(null)

    if (val.trim().length === 0) {
      setResults([])
      setOpen(false)
      return
    }

    const hits = fuseRef.current.search(val).slice(0, 6).map((r) => r.item)
    setResults(hits)
    setOpen(hits.length > 0)
    setHighlighted(0)
  }

  function handleKeyDown(e) {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[highlighted]) {
        pick(results[highlighted])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function pick(song) {
    setSelected(song)
    setQuery(`${song.title} — ${song.artist}`)
    setOpen(false)
    onSelect(song)
  }

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query && results.length > 0 && setOpen(true)}
        disabled={disabled}
        placeholder="Search for a song…"
        autoComplete="off"
        className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
          {results.map((song, i) => (
            <li
              key={song.id}
              onMouseDown={() => pick(song)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                i === highlighted ? 'bg-gray-700' : 'hover:bg-gray-750'
              }`}
            >
              {song.albumArt && (
                <img src={song.albumArt} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                <p className="text-gray-400 text-xs truncate">{song.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
