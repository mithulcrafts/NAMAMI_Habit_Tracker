// An edit form may be older than the check-in/freeze state. Only configuration
// fields may be patched; the action must retain the latest tracking records.
const EDITABLE_FIELDS = [
  'name', 'description', 'frequency', 'customDays', 'isDailyHabit', 'targetDays',
  'goalType', 'goalTarget', 'habitColor', 'customPoints', 'customStreakBonuses',
]

export const pickHabitConfiguration = (data) => Object.fromEntries(
  EDITABLE_FIELDS.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]),
)
