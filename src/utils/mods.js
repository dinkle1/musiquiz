export const MODS = {
  HR: {
    id: 'HR',
    name: 'Hard Rock',
    shortDesc: '0.5s clip',
    desc: 'Initial clip is only 0.5 seconds. Good luck.',
    color: '#ef4444',
    icon: '🔴',
    initialClipDuration: 0.5,
  },
  DT: {
    id: 'DT',
    name: 'Double Time',
    shortDesc: '1.5× speed',
    desc: 'Songs play at 1.5× speed.',
    color: '#f59e0b',
    icon: '⚡',
    playbackRate: 1.5,
  },
  HT: {
    id: 'HT',
    name: 'Half Time',
    shortDesc: '0.75× speed',
    desc: 'Songs play at 0.75× speed.',
    color: '#3b82f6',
    icon: '🐌',
    playbackRate: 0.75,
  },
  SD: {
    id: 'SD',
    name: 'Sudden Death',
    shortDesc: 'One wrong = over',
    desc: 'One wrong answer ends the entire session.',
    color: '#a855f7',
    icon: '💀',
  },
  PF: {
    id: 'PF',
    name: 'Perfect',
    shortDesc: 'No extending',
    desc: 'You must guess on the first clip. Extending or skipping ends the session.',
    color: '#eab308',
    icon: '✨',
  },
  NF: {
    id: 'NF',
    name: 'No Fail',
    shortDesc: 'Misses forgiven',
    desc: 'You cannot fail. All missed songs are forgiven.',
    color: '#22c55e',
    icon: '🛡',
  },
  HD: {
    id: 'HD',
    name: 'Hidden',
    shortDesc: 'Art disappears',
    desc: 'The blurred album art fades away after 3 seconds.',
    color: '#67e8f9',
    icon: '👁',
  },
}

// Incompatible combinations
export const INCOMPATIBLE = [
  ['SD', 'NF'],
  ['PF', 'NF'],
  ['DT', 'HT'],
]

export function getModConfig(activeMods) {
  const active = new Set(activeMods)
  return {
    initialClip:  active.has('HR') ? 0.5 : 1,
    playbackRate: active.has('DT') ? 1.5 : active.has('HT') ? 0.75 : 1,
    suddenDeath:  active.has('SD'),
    perfect:      active.has('PF'),
    noFail:       active.has('NF'),
    hidden:       active.has('HD'),
  }
}

export function getESTDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function hasDailyBeenPlayed() {
  try {
    const d = JSON.parse(localStorage.getItem('clipd_daily') || '{}')
    return d.date === getESTDate()
  } catch { return false }
}

export function markDailyPlayed(score, totalSongs) {
  localStorage.setItem('clipd_daily', JSON.stringify({
    date: getESTDate(),
    score,
    totalSongs,
  }))
}
