const pad = (n) => (n < 10 ? `0${n}` : `${n}`)

// Stored YYYY-MM-DD keys are local calendar days, not UTC timestamps.
const parseDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setFullYear(year, month - 1, day)
    date.setHours(0, 0, 0, 0)
    return date
  }
  return new Date(value)
}

export const formatDate = (dateObj) => {
  const d = typeof dateObj === 'string' ? parseDate(dateObj) : dateObj
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayKey = () => formatDate(new Date())

export const getPastDate = (daysAgo) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return formatDate(d)
}

export const computeStreak = (history) => {
  if (!history) return 0
  let streak = 0
  let cursor = new Date()
  while (true) {
    const key = formatDate(cursor)
    if (history[key]) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

export const countCompletions = (history) =>
  Object.values(history || {}).filter(Boolean).length

export const getLastNDates = (days) =>
  Array.from({ length: days }).map((_, idx) => getPastDate(days - idx - 1))

export const startOfWeek = (dateKey) => {
  const d = parseDate(dateKey)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return formatDate(d)
}

export const getWeekBuckets = (history) => {
  const buckets = {}
  Object.entries(history || {}).forEach(([dateKey, done]) => {
    if (!done) return
    const bucket = startOfWeek(dateKey)
    buckets[bucket] = (buckets[bucket] || 0) + 1
  })
  return buckets
}

export const getMonthBuckets = (history) => {
  const buckets = {}
  Object.entries(history || {}).forEach(([dateKey, done]) => {
    if (!done) return
    const monthKey = dateKey.slice(0, 7) // YYYY-MM
    buckets[monthKey] = (buckets[monthKey] || 0) + 1
  })
  return buckets
}

export const isToday = (dateKey) => dateKey === todayKey()
