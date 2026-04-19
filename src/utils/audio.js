let currentAudio = null

export function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

export function playClip(url, startOffset, durationSecs) {
  stopCurrentAudio()

  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'auto'
    currentAudio = audio

    let settled = false
    let timer = null

    function finish() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }

    audio.addEventListener('error', finish, { once: true })

    // Once enough data is loaded, seek to the desired offset
    audio.addEventListener('canplay', () => {
      if (currentAudio !== audio) { finish(); return }
      const safe = Math.min(startOffset, Math.max(0, (audio.duration || 30) - durationSecs - 0.5))
      audio.currentTime = safe
    }, { once: true })

    // Once seek completes, start playing and set stop timer
    audio.addEventListener('seeked', () => {
      if (currentAudio !== audio) { finish(); return }
      audio.play().catch(finish)
      timer = setTimeout(() => {
        if (currentAudio === audio) audio.pause()
        finish()
      }, durationSecs * 1000)
    }, { once: true })

    // Hard timeout in case events don't fire
    setTimeout(finish, (durationSecs + 15) * 1000)

    audio.src = url
    audio.load()
  })
}

export function getRandomOffset() {
  return Math.random() * 20
}

// Pre-warm an audio URL so it's in the browser cache
export function preloadAudio(url) {
  if (!url) return
  const a = new Audio()
  a.preload = 'auto'
  a.src = url
}

// No-op kept for API compatibility with App.jsx
export function clearAudioCache() {}
