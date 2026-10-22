
import { useState } from 'react'

const defaultData = {
  name: '',
  description: '',
  frequency: 'daily',
  customDays: [],
  isDailyHabit: true,
  targetDays: null,
  goalType: 'binary',
  goalTarget: null,
  habitColor: '#00F5FF',
  customPoints: 10,
  customStreakBonuses: { 3: 2, 7: 5, 30: 10 },
}

const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const colorOptions = [
  '#00F5FF', // Neon Cyan
  '#B026FF', // Electric Purple
  '#00FFA3', // Mint Neon
  '#FFC857', // Amber
  '#FF006E', // Hot Pink
  '#00D9FF', // Sky Cyan
  '#39FF14', // Neon Green
  '#FF10F0', // Magenta
]

const getInitialFormData = (initial) => {
  if (!initial) {
    return {
      ...defaultData,
      customDays: [...defaultData.customDays],
      customStreakBonuses: { ...defaultData.customStreakBonuses },
    }
  }

  return {
    ...defaultData,
    ...initial,
    customDays: [...(initial.customDays ?? defaultData.customDays)],
    customStreakBonuses: {
      ...defaultData.customStreakBonuses,
      ...(initial.customStreakBonuses ?? {}),
    },
  }
}

const getThemeClasses = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    inputBorder: isDark ? 'border-cyan-400/20' : 'border-blue-400/20',
    inputBg: isDark ? 'dark:bg-black bg-slate-100' : 'bg-white/60',
    inputText: isDark ? 'dark:text-cyan-200 text-slate-900' : 'text-slate-900',
    inputBgDark: isDark ? 'bg-slate-900/40' : 'bg-white/50',
    inputTextDark: isDark ? 'text-cyan-200' : 'text-slate-900',
    labelText: isDark ? 'text-slate-200' : 'text-slate-700',
    buttonCancel: isDark ? 'border-cyan-400/20' : 'border-blue-400/20',
    buttonCancelHover: isDark ? 'hover:border-cyan-400/40' : 'hover:border-blue-400/30',
    buttonCancelText: isDark ? 'text-slate-200' : 'text-slate-700',
  }
}

export const HabitForm = ({ onSave, onCancel, initial }) => {

  const [form, setForm] = useState(initial || defaultData)
  const theme = getThemeClasses()

  const toggleDay = (index) => {
    setForm((prev) => {
      const exists = prev.customDays?.includes(index)
      const nextDays = exists
        ? prev.customDays.filter((d) => d !== index)
        : [...(prev.customDays || []), index]
      return { ...prev, customDays: nextDays }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validation: goalTarget must be > 0 if goal type is not binary
    if (form.goalType !== 'binary' && (!form.goalTarget || form.goalTarget <= 0)) {
      alert('Please enter a valid target value (must be greater than 0)')
      return
    }
    
    // Validation: targetDays must be > 0 if target-based
    if (!form.isDailyHabit && (!form.targetDays || form.targetDays <= 0)) {
      alert('Please enter valid target days (must be greater than 0)')
      return
    }
    
    const dataToSave = { ...form }
    if (dataToSave.isDailyHabit) {
      delete dataToSave.targetDays
    }
    onSave(dataToSave)
    if (!initial) setForm(getInitialFormData())
  }

  // Check if form is valid for submission
  const isFormValid = () => {
    if (!form.name.trim()) return false
    if (form.goalType !== 'binary' && (!form.goalTarget || form.goalTarget <= 0)) return false
    if (!form.isDailyHabit && (!form.targetDays || form.targetDays <= 0)) return false
    return true
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="habit-name" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>HABIT NAME</label>
        <input
          id="habit-name"
          className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBg} backdrop-blur px-3 py-2 text-sm ${theme.inputText} placeholder-slate-400 focus:border-brand-400 focus:ring-brand-400`}
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
      </div>
      <div>
        <label htmlFor="habit-description" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>DESCRIPTION</label>
        <textarea
          id="habit-description"
          className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-3 py-2 text-sm ${theme.inputTextDark} placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400`}
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={2}
        />
      </div>

      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-slate-200">HABIT TYPE</p>
        <div className="mt-2 flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="habitType"
              value="daily"
              checked={form.isDailyHabit}
              onChange={() => setForm((p) => ({ ...p, isDailyHabit: true }))}
            />
            <span className="text-sm text-slate-200">Daily habit (no target)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="habitType"
              value="target"
              checked={!form.isDailyHabit}
              onChange={() => setForm((p) => ({ ...p, isDailyHabit: false }))}
            />
            <span className="text-sm text-slate-200">Target-based challenge</span>
          </label>
        </div>
      </div>

      <div>
        <p className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>GOAL TYPE</p>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="goalType"
              value="binary"
              checked={form.goalType === 'binary'}
              onChange={() => setForm((p) => ({ ...p, goalType: 'binary', goalTarget: null }))}
            />
            <span className="text-sm text-slate-200">Binary (done / not done)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="goalType"
              value="count"
              checked={form.goalType === 'count'}
              onChange={() => setForm((p) => ({ ...p, goalType: 'count', goalTarget: null }))}
            />
            <span className="text-sm text-slate-200">Count-based (e.g., read 10 pages)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="goalType"
              value="duration"
              checked={form.goalType === 'duration'}
              onChange={() => setForm((p) => ({ ...p, goalType: 'duration', goalTarget: null }))}
            />
            <span className="text-sm text-slate-200">Duration-based (e.g., meditate 20 min)</span>
          </label>
        </div>
      </div>

      {form.goalType !== 'binary' && (
        <div>
          <label htmlFor="goal-target" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>
            {form.goalType === 'count' ? 'TARGET COUNT' : 'TARGET MINUTES'}
          </label>
          <input
            id="goal-target"
            type="text"
            inputMode="numeric"
            className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-3 py-2 text-sm ${theme.inputTextDark} placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400`}
            placeholder="Enter target value"
            value={form.goalTarget ?? ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '')
              setForm((p) => ({ ...p, goalTarget: val ? Number(val) : null }))
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="habit-frequency" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>FREQUENCY</label>
          <select
            id="habit-frequency"
            className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-3 py-2 text-sm ${theme.inputTextDark} focus:border-brand-400 focus:ring-brand-400`}
            value={form.frequency}
            onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom days</option>
          </select>
        </div>
        {!form.isDailyHabit && (
          <div>
            <label htmlFor="target-days" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>TARGET DAYS</label>
            <input
              id="target-days"
              type="text"
              inputMode="numeric"
              className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-3 py-2 text-sm ${theme.inputTextDark} placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400`}
              placeholder="Enter target days"
              value={form.targetDays ?? ''}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '')
                setForm((p) => ({ ...p, targetDays: val ? Number(val) : null }))
              }}
            />
          </div>
        )}
      </div>
      {form.frequency === 'custom' && (
        <div>
          <p className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>SELECT DAYS</p>
          <div className="mt-2 flex gap-2">
            {days.map((label, idx) => {
              const active = form.customDays?.includes(idx)
              return (
                <button
                  type="button"
                  key={label + idx}
                  onClick={() => toggleDay(idx)}
                  className={`h-9 w-9 rounded-full border text-sm font-bold uppercase ${
                    active
                      ? 'border-brand-400 bg-brand-500/20 text-brand-100'
                      : 'border-white/10 bg-slate-900/40 text-slate-200'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div>
        <p className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>HEATMAP COLOR</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((p) => ({ ...p, habitColor: color }))}
              className={`h-10 w-10 rounded-lg border-2 transition shadow-lg ${
                form.habitColor === color
                  ? 'border-white ring-2 ring-offset-2 ring-offset-slate-950'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
              style={{ 
                backgroundColor: color,
                boxShadow: `0 0 12px ${color}80, 0 0 24px ${color}40 ${form.habitColor === color ? `, 0 0 8px ${color}` : ''}`
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="habit-custom-points" className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>MITHURA PER COMPLETION</label>
        <input
          id="habit-custom-points"
          type="text"
          inputMode="numeric"
          className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-3 py-2 text-sm ${theme.inputTextDark} placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400`}
          value={form.customPoints ?? ''}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, '')
            setForm((p) => ({ ...p, customPoints: val ? Number(val) : null }))
          }}
          placeholder="Enter points"
        />
        <p className="mt-1 text-xs text-slate-400">Points earned for completing this habit</p>
      </div>

      <div>
        <p className={`text-sm font-bold uppercase tracking-wider ${theme.labelText}`}>STREAK BONUSES (FOR THIS HABIT)</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[3, 7, 30].map((days) => (
            <div key={days}>
              <label htmlFor={`habit-streak-bonus-${days}`} className="text-xs text-slate-400">{days}-day streak</label>
              <input
                id={`habit-streak-bonus-${days}`}
                type="number"
                min="0"
                value={form.customStreakBonuses?.[days] ?? 0}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    customStreakBonuses: { ...p.customStreakBonuses, [days]: Number(e.target.value) },
                  }))
                }
                className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBgDark} backdrop-blur px-2 py-1 text-sm ${theme.inputTextDark} placeholder-slate-500 focus:border-brand-400 focus:ring-brand-400`}
              />
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">Bonus MITHURA for maintaining streaks on this habit</p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-md border ${theme.buttonCancel} px-4 py-2 text-sm font-bold uppercase tracking-wider ${theme.buttonCancelText} ${theme.buttonCancelHover}`}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!isFormValid()}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-soft hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initial ? 'Save changes' : 'Add habit'}
        </button>
      </div>
    </form>
  )
}
