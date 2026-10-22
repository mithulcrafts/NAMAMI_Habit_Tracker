import { useState } from 'react'
import { isValidScoringPatch } from '../utils/scoringValidation'

export const Settings = ({ settings, onUpdate, onAdjustMithura }) => {
  const [local, setLocal] = useState(() => ({ ...settings }))

  const handleSave = () => {
    if (!isValidScoringPatch(local)) {
      alert('Please enter bonus amounts of 0 or more.')
      return
    }
    onUpdate(local)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold uppercase tracking-wider text-white">⚙️ SETTINGS</h3>
      <p className="text-xs text-slate-400">Configure global gamification defaults. Per-habit overrides are set on individual habit detail pages.</p>
      
      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass rounded-xl p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-white">GLOBAL BONUSES</p>
          <p className="mt-1 text-xs text-slate-400">These bonuses apply when ALL habits are completed</p>
          
          <label htmlFor="daily-bonus" className="mt-3 block text-sm text-slate-300">DAILY BONUS (ALL HABITS DONE)</label>
          <input
            id="daily-bonus"
            type="number"
            min="0"
            value={local.dailyBonus}
            onChange={(e) => setLocal((p) => ({ ...p, dailyBonus: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-cyan-400/20 bg-slate-900/40 backdrop-blur px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">Awarded when you complete all habits in a day</p>

          <div className="mt-4">
            <p className="block text-sm text-slate-300">GLOBAL STREAK BONUSES</p>
            <p className="mt-1 text-xs text-slate-400">Awarded for consecutive days of completing ALL habits</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[3, 7, 30].map((days) => (
                <div key={days}>
                  <label htmlFor={`global-streak-${days}`} className="text-xs text-slate-400">{days}-day</label>
                  <input
                    id={`global-streak-${days}`}
                    type="number"
                    min="0"
                    value={local.globalStreakBonuses?.[days] ?? 0}
                    onChange={(e) =>
                      setLocal((p) => ({
                        ...p,
                        globalStreakBonuses: { ...p.globalStreakBonuses, [days]: Number(e.target.value) },
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-cyan-400/20 bg-slate-900/40 backdrop-blur px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-white">APPEARANCE</p>
          <label htmlFor="theme-select" className="mt-3 block text-sm text-slate-300">THEME</label>
          <select
            id="theme-select"
            value={local.theme ?? 'dark'}
            onChange={(e) => setLocal((p) => ({ ...p, theme: e.target.value }))}
            className="mt-1 w-full rounded-md border border-cyan-400/20 bg-slate-900/40 backdrop-blur px-3 py-2 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="glass rounded-xl p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-white">FEATURES</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <label htmlFor="enable-gamification" className="text-sm text-slate-300">ENABLE GAMIFICATION</label>
            <input
              id="enable-gamification"
              type="checkbox"
              checked={local.gamificationEnabled}
              onChange={(e) => setLocal((p) => ({ ...p, gamificationEnabled: e.target.checked }))}
            />
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-white">QUOTE SETTINGS</p>
          <label htmlFor="quote-category" className="mt-3 block text-sm text-slate-300">PREFERRED QUOTE CATEGORY</label>
          <select
            id="quote-category"
            value={local.quoteCategory ?? 'general'}
            onChange={(e) => setLocal((p) => ({ ...p, quoteCategory: e.target.value }))}
            className="mt-1 w-full rounded-md border border-cyan-400/20 bg-slate-900/40 backdrop-blur px-3 py-2 text-sm"
          >
            <option value="general">General inspirational</option>
            <option value="gita">Bhagavad Gita wisdom</option>
          </select>
        </div>
      </div>

      <MithuraAdjustment onAdjust={onAdjustMithura} />

      <button
        onClick={handleSave}
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-400"
      >
        Save settings
      </button>
    </div>
  )
}

const MithuraAdjustment = ({ onAdjust }) => {
  const [amount, setAmount] = useState('')

  const handleAdjust = () => {
    const value = parseInt(amount, 10)
    if (isNaN(value) || value === 0) {
      alert('Please enter a valid non-zero number')
      return
    }
    onAdjust(value)
    setAmount('')
  }

  return (
    <div className="mt-4 glass rounded-xl p-4">
      <p className="text-sm font-bold uppercase tracking-wider text-white\">⚖️ MANUAL MITHURA ADJUSTMENT</p>
      <p className="mt-1 text-xs text-slate-400\">
        Adjust MITHURA for external rewards or corrections
      </p>
      <p className="mt-2 text-xs text-slate-400\">
        • Positive number (e.g., 10): Spend MITHURA (adds to used, reduces available)
      </p>
      <p className="text-xs text-slate-400\">
        • Negative number (e.g., -5): Refund MITHURA (removes from used, increases available)
      </p>
      
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="mithura-adjustment" className="sr-only">Manual Mithura adjustment amount</label>
        <input
          id="mithura-adjustment"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount (e.g., 10 or -5)"
          className="flex-1 rounded-md border border-cyan-400/20 bg-slate-900/40 backdrop-blur px-3 py-2 text-sm"
        />
        <button
          onClick={handleAdjust}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-brand-400 whitespace-nowrap"
        >
          Adjust
        </button>
      </div>
    </div>
  )
}
