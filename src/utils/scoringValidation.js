const nonnegative = value => Number.isFinite(value) && value >= 0
const bonuses = value => value != null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(nonnegative)

export const isValidRewardCost = value => Number.isFinite(value) && value >= 1

// Validate incoming edits only. Never rewrite previously saved records or
// historical reward costs, and retain null's existing "use defaults" meaning.
export const isValidScoringPatch = data => {
  if (Object.hasOwn(data, 'dailyBonus') && !nonnegative(data.dailyBonus)) return false
  if (data.customPoints != null && !nonnegative(data.customPoints)) return false
  for (const key of ['customStreakBonuses', 'globalStreakBonuses']) {
    if (data[key] != null && !bonuses(data[key])) return false
  }
  return true
}
