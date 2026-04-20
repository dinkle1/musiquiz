let currentAudio = null
let globalVolume = 0.8

export function setVolume(v) {
  globalVolume = Math.max(0, Math.min(1, v))
  if (currentAudio) currentAudio.volume = globalVolume
}

export function getVolume() {
  return globalVolume
}

export function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}

export function playClip(url, startOffset, durationSecs, { rate = 1 } = {}) {
  stopCurrentAudio()

  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = globalVolume
    audio.playbackRate = Math.max(0.1, Math.min(4, rate))
    currentAudio = audio

    let settled = false
    let timer = null

    function finish() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }

    // Adjust duration for playback rate so the clip always covers the
    // same real-time window regardless of speed
    const adjustedDuration = durationSecs / audio.playbackRate

    audio.addEventListener('error', finish, { once: true })

    audio.addEventListener('canplay', () => {
      if (currentAudio !== audio) { finish(); return }
      const safe = Math.min(startOffset, Math.max(0, (audio.duration || 30) - durationSecs - 0.5))
      audio.currentTime = safe
    }, { once: true })

    audio.addEventListener('seeked', () => {
      if (currentAudio !== audio) { finish(); return }
      audio.play().catch(finish)
      timer = setTimeout(() => {
        if (currentAudio === audio) audio.pause()
        finish()
      }, adjustedDuration * 1000)
    }, { once: true })

    setTimeout(finish, (adjustedDuration + 15) * 1000)

    audio.src = url
    audio.load()
  })
}

export function getRandomOffset() {
  return Math.random() * 20
}

export function preloadAudio(url) {
  if (!url) return
  const a = new Audio()
  a.preload = 'auto'
  a.src = url
}

export function clearAudioCache() {}
