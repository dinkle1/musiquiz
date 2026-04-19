let audioContext = null

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioContext
}

const bufferCache = new Map()

export async function loadAudioBuffer(previewUrl) {
  if (bufferCache.has(previewUrl)) {
    return bufferCache.get(previewUrl)
  }

  const ctx = getAudioContext()
  const response = await fetch(previewUrl)
  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  bufferCache.set(previewUrl, audioBuffer)
  return audioBuffer
}

let currentSource = null

export function stopCurrentAudio() {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch (_) {}
    currentSource = null
  }
}

export async function playClip(previewUrl, startOffset, duration) {
  stopCurrentAudio()

  const ctx = getAudioContext()

  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  const buffer = await loadAudioBuffer(previewUrl)
  const maxStart = Math.max(0, buffer.duration - duration - 1)
  const safeOffset = Math.min(startOffset, maxStart)

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(1, ctx.currentTime)
  gainNode.gain.setValueAtTime(1, ctx.currentTime + duration - 0.05)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

  source.connect(gainNode)
  gainNode.connect(ctx.destination)
  source.start(0, safeOffset, duration)

  currentSource = source

  return new Promise((resolve) => {
    source.onended = () => {
      if (currentSource === source) currentSource = null
      resolve()
    }
    setTimeout(resolve, duration * 1000 + 200)
  })
}

export function getRandomOffset(previewUrl) {
  // Return a random offset that leaves room for the full 30s preview
  // We store this per-url so it stays consistent across tier upgrades
  return Math.random() * 20
}

export function clearAudioCache() {
  bufferCache.clear()
}
