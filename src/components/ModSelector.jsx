import { MODS, INCOMPATIBLE } from '../utils/mods.js'

export default function ModSelector({ activeMods, onToggle, onClose, onConfirm }) {
  function isDisabled(modId) {
    for (const pair of INCOMPATIBLE) {
      if (pair.includes(modId)) {
        const other = pair.find(m => m !== modId)
        if (activeMods.has(other)) return true
      }
    }
    return false
  }

  const activeList = [...activeMods]
  const multiplier = 1 +
    (activeMods.has('HR') ? 0.06 : 0) +
    (activeMods.has('DT') ? 0.12 : 0) +
    (activeMods.has('SD') ? 0.1 : 0) +
    (activeMods.has('PF') ? 0.14 : 0) +
    (activeMods.has('HD') ? 0.06 : 0) +
    (activeMods.has('NF') ? -0.5 : 0) +
    (activeMods.has('HT') ? -0.1 : 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-6 space-y-5 slide-up"
        style={{ background: 'var(--bg-2)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl text-[var(--neon)]" style={{ fontFamily: 'Righteous' }}>
            Select Mods
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white transition-colors cursor-pointer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.values(MODS).map((mod) => {
            const active = activeMods.has(mod.id)
            const disabled = isDisabled(mod.id)
            return (
              <button
                key={mod.id}
                onClick={() => !disabled && onToggle(mod.id)}
                disabled={disabled}
                className="relative rounded-xl p-3 text-left transition-all duration-200 cursor-pointer"
                style={{
                  background: active ? `${mod.color}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? mod.color : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active ? `0 0 16px ${mod.color}44` : 'none',
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="text-2xl mb-1">{mod.icon}</div>
                <div className="font-bold text-sm text-white" style={{ fontFamily: 'Righteous' }}>{mod.name}</div>
                <div className="text-xs mt-0.5" style={{ color: active ? mod.color : 'var(--muted)' }}>{mod.shortDesc}</div>
                {active && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ background: mod.color, boxShadow: `0 0 6px ${mod.color}` }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Descriptions for active mods */}
        {activeList.length > 0 && (
          <div className="space-y-2">
            {activeList.map(id => {
              const mod = MODS[id]
              return (
                <div key={id} className="flex items-start gap-2 text-xs rounded-lg px-3 py-2"
                     style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}33` }}>
                  <span>{mod.icon}</span>
                  <span style={{ color: mod.color }}><strong>{mod.name}:</strong> {mod.desc}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Score multiplier */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Score multiplier</span>
          <span
            className="font-bold text-lg"
            style={{
              fontFamily: 'Righteous',
              color: multiplier > 1 ? 'var(--neon)' : multiplier < 1 ? 'var(--red)' : 'var(--text)',
            }}
          >
            {multiplier.toFixed(2)}×
          </span>
        </div>

        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-xl font-bold text-black cursor-pointer transition-all duration-200"
          style={{
            background: 'var(--neon)',
            fontFamily: 'Righteous',
            boxShadow: '0 0 20px rgba(0,255,135,0.3)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,135,0.6)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,135,0.3)'}
        >
          {activeList.length === 0 ? 'Play Without Mods' : `Play with ${activeList.join(' + ')}`}
        </button>
      </div>
    </div>
  )
}
