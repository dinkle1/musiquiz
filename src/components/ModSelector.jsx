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
  const multiplier = 1
    + (activeMods.has('HR') ? 0.06 : 0)
    + (activeMods.has('DT') ? 0.12 : 0)
    + (activeMods.has('SD') ? 0.10 : 0)
    + (activeMods.has('PF') ? 0.14 : 0)
    + (activeMods.has('HD') ? 0.06 : 0)
    + (activeMods.has('NF') ? -0.5 : 0)
    + (activeMods.has('HT') ? -0.1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-lg p-6 space-y-5 slide-up"
           style={{ background: '#242424', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white tracking-tight">Select Mods</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.values(MODS).map(mod => {
            const active   = activeMods.has(mod.id)
            const disabled = isDisabled(mod.id)
            return (
              <button key={mod.id}
                onClick={() => !disabled && onToggle(mod.id)}
                disabled={disabled}
                className="relative rounded-lg p-3 text-left transition-all duration-200 cursor-pointer"
                style={{
                  background: active ? `${mod.color}18` : 'var(--bg-hover)',
                  border: `1px solid ${active ? mod.color : 'transparent'}`,
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}>
                <div className="text-xl mb-1">{mod.icon}</div>
                <div className="font-bold text-sm text-white">{mod.name}</div>
                <div className="text-xs mt-0.5" style={{ color: active ? mod.color : 'var(--muted)' }}>{mod.shortDesc}</div>
                {active && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
                       style={{ background: mod.color }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Active mod descriptions */}
        {activeList.length > 0 && (
          <div className="space-y-1.5">
            {activeList.map(id => {
              const mod = MODS[id]
              return (
                <div key={id} className="flex items-start gap-2 text-xs rounded px-3 py-2"
                     style={{ background: `${mod.color}12`, border: `1px solid ${mod.color}30` }}>
                  <span>{mod.icon}</span>
                  <span style={{ color: mod.color }}><strong>{mod.name}:</strong> {mod.desc}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Score multiplier</span>
          <span className="text-lg font-black" style={{ color: multiplier >= 1 ? 'var(--green)' : '#ef4444' }}>
            {multiplier.toFixed(2)}×
          </span>
        </div>

        <button onClick={onConfirm} className="btn-primary w-full justify-center py-3">
          {activeList.length === 0 ? 'Play Without Mods' : `Play with ${activeList.join(' + ')}`}
        </button>
      </div>
    </div>
  )
}
