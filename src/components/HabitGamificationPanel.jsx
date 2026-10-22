import { isValidScoringPatch } from '../utils/scoringValidation'

const getThemeClasses = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    inputBorder: isDark ? 'border-cyan-400/20' : 'border-blue-400/20',
    inputBg: isDark ? 'bg-slate-900/40' : 'bg-white/50',
  }
}

export const HabitGamificationPanel = ({ habit, onUpdate }) => {
  const customPoints = habit.customPoints ?? 10
  const customBonuses = habit.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 }
  const theme = getThemeClasses()
  const update = (id, useGlobal, points, bonuses) => {
    if (isValidScoringPatch({ customPoints: points, customStreakBonuses: bonuses })) {
      onUpdate(id, useGlobal, points, bonuses)
    }
  }

  return (
    <div className="glass rounded-xl p-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-white">MITHURA FOR THIS HABIT</h4>
      <p className="mt-1 text-xs text-slate-400">Each habit has its own points and streak bonuses</p>
      
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="habit-panel-custom-points" className="text-sm font-bold uppercase tracking-wider text-slate-200">MITHURA PER COMPLETION</label>
          <input
            id="habit-panel-custom-points"
            type="number"
            min="1"
            value={customPoints}
            onChange={(e) =>
              update(
                habit.id,
                false,
                Number(e.target.value),
                customBonuses
              )
            }
            className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBg} backdrop-blur px-3 py-2 text-sm`}
          />
        </div>
        
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-slate-200">STREAK BONUSES</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[3, 7, 30].map((days) => (
              <div key={days}>
                <label htmlFor={`habit-panel-streak-${days}`} className="text-xs text-slate-400">{days}-day</label>
                <input
                  id={`habit-panel-streak-${days}`}
                  type="number"
                  min="0"
                  value={customBonuses?.[days] ?? 0}
                  onChange={(e) =>
                    update(
                      habit.id,
                      false,
                      customPoints,
                      { ...customBonuses, [days]: Number(e.target.value) }
                    )
                  }
                  className={`mt-1 w-full rounded-md border ${theme.inputBorder} ${theme.inputBg} backdrop-blur px-2 py-1 text-sm`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
