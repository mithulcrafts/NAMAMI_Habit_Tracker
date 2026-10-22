const getThemeClasses = () => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return {
    borderBadge: isDark ? 'border-emerald-500/40' : 'border-emerald-400/30',
    borderBadgeHover: isDark ? 'hover:border-emerald-500/60' : 'hover:border-emerald-400/50',
    textAchieved: isDark ? 'text-emerald-300' : 'text-emerald-600',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    bgHabitInfo: isDark ? 'bg-slate-900/30' : 'bg-slate-100/60',
  }
}

export const EarnedBadges = ({ earnedBadges, badgeDefinitions, habits }) => {
  const theme = getThemeClasses()

  // Group badges by badge id to count occurrences
  const badgeCounts = {}
  const badgesByHabit = {}

  earnedBadges?.forEach((badge) => {
    const badgeId = badge.badgeId
    badgeCounts[badgeId] = (badgeCounts[badgeId] || 0) + 1

    if (badge.habitId) {
      if (!badgesByHabit[badgeId]) {
        badgesByHabit[badgeId] = {}
      }
      badgesByHabit[badgeId][badge.habitId] = (badgesByHabit[badgeId][badge.habitId] || 0) + 1
    }
  })

  if (!earnedBadges || earnedBadges.length === 0) {
    return (
      <div className="glass rounded-lg p-4 text-center">
        <p className="text-sm text-slate-400">No badges earned yet. Start building habits to earn badges!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badgeDefinitions
          .filter((badge) => badgeCounts[badge.id])
          .map((badge) => {
            const count = badgeCounts[badge.id] || 0
            const habitsForBadge = badgesByHabit[badge.id] || {}

            return (
              <div
                key={badge.id}
                className={`glass rounded-lg p-4 border-emerald-500/40 ${theme.borderBadge} ${theme.borderBadgeHover}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{badge.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-bold uppercase tracking-wide text-white">{badge.label}</h3>
                    <p className={`text-xs ${theme.textAchieved} mt-1 font-semibold`}>EARNED {count}x</p>

                    {badge.habitSpecific && Object.keys(habitsForBadge).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(habitsForBadge).map(([habitId, habitCount]) => {
                          const habit = habits?.find((h) => h.id === habitId)
                          return (
                            <div key={habitId} className={`text-xs ${theme.textSecondary} ${theme.bgHabitInfo} rounded px-2 py-1`}>
                              <span className="font-bold">{habit?.name || earnedBadges.find(entry => entry.habitId === habitId && entry.habitName)?.habitName || 'Unknown habit'}:</span> {habitCount}x
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
