import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import localforage from 'localforage'
import { generalQuotes, gitaQuotes } from '../data/quotes'
import {
  formatDate,
  todayKey,
} from '../utils/date'

import { loadStoredState, STORAGE_KEY } from '../utils/stateStorage'
import { pickHabitConfiguration } from '../utils/habitConfiguration'
const SCHEMA_VERSION = 6
const STREAK_FREEZE_COST = 60

// Helper to generate deterministic color from habit ID
const getHabitColor = (id) => {
  const colors = ['#38bdf8', '#c084fc', '#34d399', '#fbbf24', '#f87171', '#818cf8', '#ec4899', '#14b8a6']
  const hash = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return colors[hash % colors.length]
}

const defaultHabits = [
  {
    id: 'habit-1',
    name: 'Morning Walk',
    description: '20-minute mindful walk to start the day',
    frequency: 'daily',
    customDays: [],
    isDailyHabit: true,
    targetDays: null,
    habitColor: '#38bdf8',
    useGlobalGamification: true,
    customPoints: 10,
    customStreakBonuses: { 3: 2, 7: 5, 30: 10 },
    goalType: 'binary',
    goalTarget: null,
    dailyValueHistory: {},
    history: {
      [todayKey()]: true,
      [formatDate(new Date(Date.now() - 86400000))]: true,
      [formatDate(new Date(Date.now() - 2 * 86400000))]: true,
    },
    createdAt: todayKey(),
    previousStreak: 0,
    streakMilestones: {},
    freezeDates: {},
  },
  {
    id: 'habit-2',
    name: 'Reading',
    description: 'Read 10 pages of a book',
    frequency: 'custom',
    customDays: [1, 3, 5],
    isDailyHabit: false,
    targetDays: 20,
    habitColor: '#c084fc',
    useGlobalGamification: true,
    customPoints: 10,
    customStreakBonuses: { 3: 2, 7: 5, 30: 10 },
    goalType: 'binary',
    goalTarget: null,
    dailyValueHistory: {},
    history: {},
    createdAt: todayKey(),
    previousStreak: 0,
    streakMilestones: {},
    freezeDates: {},
  },
]

const defaultRewards = [
  { id: 'reward-1', name: 'Coffee treat', requiredPoints: 50, deleted: false },
  { id: 'reward-2', name: 'Movie night', requiredPoints: 120, deleted: false },
]

const calculatePointsSpent = (claimedRewards, rewards) =>
  (claimedRewards || []).reduce((sum, entry) => {
    const reward = (rewards || []).find((r) => r.id === entry.rewardId)
    const cost = entry.cost ?? reward?.requiredPoints ?? 0
    return sum + Math.max(0, cost)
  }, 0)

const defaultSettings = {
  dailyBonus: 20,
  gamificationEnabled: true,
  quoteCategory: 'general',
  theme: 'dark',
  globalStreakBonuses: {
    3: 5,
    7: 10,
    30: 20,
  },
}

// Badge definitions
const BADGE_DEFINITIONS = [
  { id: 'streak-3', label: '3-day Streak', habitSpecific: true, requirement: 3, type: 'streak', icon: '🔥' },
  { id: 'streak-7', label: '7-day Streak', habitSpecific: true, requirement: 7, type: 'streak', icon: '🌟' },
  { id: 'streak-30', label: '30-day Streak', habitSpecific: true, requirement: 30, type: 'streak', icon: '👑' },
  { id: 'points-100', label: '100+ MITHURA', habitSpecific: false, requirement: 100, type: 'points', icon: '💎' },
  { id: 'points-500', label: '500+ MITHURA', habitSpecific: false, requirement: 500, type: 'points', icon: '✨' },
]

const AppContext = createContext()

const deriveStats = (habits, settings) => {
  const isHabitCompletedOnDate = (habit, dateKey) => {
    if (habit.goalType === 'binary') {
      return habit.history?.[dateKey] === true
    }
    const value = habit.dailyValueHistory?.[dateKey] ?? 0
    return value >= (habit.goalTarget || 1)
  }

  const enriched = habits.map((habit) => {
    // Compute streak: include today if completed/frozen; otherwise show streak up to yesterday
    let streak = 0
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const today = todayKey()
    
    while (true) {
      const key = formatDate(cursor)
      const isFrozen = habit.freezeDates?.[key] === true
      if (isFrozen) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
        continue
      }

      const dayEntry = habit.history?.[key]

      // If day exists and is explicitly false, break the streak
      if (dayEntry === false) {
        if (key === today) {
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        break
      }

      const isCompleted = isHabitCompletedOnDate(habit, key)
      if (isCompleted) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else {
        // If today is not yet completed, fall back to streak up to yesterday
        if (key === today) {
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        // Day not completed - stop counting
        break
      }
    }

    // Count total completions (days where target was met)
    const uniqueDateKeys = new Set([
      ...Object.keys(habit.history || {}),
      ...Object.keys(habit.dailyValueHistory || {}),
    ])
    const totalCompleted = Array.from(uniqueDateKeys).filter((dateKey) => isHabitCompletedOnDate(habit, dateKey)).length

    const completionRate =
      habit.isDailyHabit ? null : Math.min(100, Math.round((totalCompleted / (habit.targetDays || 1)) * 100))

    return { ...habit, streak, totalCompleted, completionRate }
  })

  // Collect all completed dates for bonuses (only when target is met)
  const completedDates = {}
  enriched.forEach((habit) => {
    const keys = new Set([
      ...Object.keys(habit.history || {}),
      ...Object.keys(habit.dailyValueHistory || {}),
    ])
    keys.forEach((dateKey) => {
      if (isHabitCompletedOnDate(habit, dateKey)) {
        completedDates[dateKey] = (completedDates[dateKey] || 0) + 1
      }
    })
  })

  const bonusDays = Object.entries(completedDates).filter(([, count]) => count >= enriched.length)

  const basePoints = settings.gamificationEnabled
    ? enriched.reduce((sum, habit) => {
        const pointsPerCompletion = habit.customPoints ?? 10
        return sum + habit.totalCompleted * pointsPerCompletion
      }, 0)
    : 0

  const dailyBonusPoints = settings.gamificationEnabled ? bonusDays.length * settings.dailyBonus : 0

  const perHabitStreakBonus = settings.gamificationEnabled
    ? enriched.reduce((sum, habit) => {
        const bonuses = habit.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 }
        if (habit.streak >= 30) return sum + (bonuses[30] || 0)
        if (habit.streak >= 7) return sum + (bonuses[7] || 0)
        if (habit.streak >= 3) return sum + (bonuses[3] || 0)
        return sum
      }, 0)
    : 0

  // Calculate global streak (consecutive days where ALL habits were completed)
  let globalStreak = 0
  if (settings.gamificationEnabled && enriched.length > 0) {
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const today = todayKey()
    while (true) {
      const key = formatDate(cursor)
      const allCompleted = enriched.every((habit) => {
        const isFrozen = habit.freezeDates?.[key] === true
        return isFrozen || isHabitCompletedOnDate(habit, key)
      })
      if (allCompleted) {
        globalStreak += 1
        cursor.setDate(cursor.getDate() - 1)
      } else if (key === today) {
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }
  }

  const globalStreakBonus = settings.gamificationEnabled
    ? (() => {
        const bonuses = settings.globalStreakBonuses ?? { 3: 5, 7: 10, 30: 20 }
        if (globalStreak >= 30) return bonuses[30] || 0
        if (globalStreak >= 7) return bonuses[7] || 0
        if (globalStreak >= 3) return bonuses[3] || 0
        return 0
      })()
    : 0

  const totalPoints = basePoints + dailyBonusPoints + perHabitStreakBonus + globalStreakBonus

  return {
    habits: enriched,
    points: totalPoints,
    bonusDays: bonusDays.map(([dateKey]) => dateKey),
    globalStreak,
  }
}

// Check which badges should be earned based on current state
const checkBadgesEarned = (habits, points) => {
  const badges = []
  
  // Streak-based badges (per habit)
  habits.forEach((habit) => {
    BADGE_DEFINITIONS.filter(b => b.type === 'streak').forEach((badge) => {
      const currentMilestone = Math.floor(habit.streak / badge.requirement)
      const previousMilestone = Math.floor((habit.previousStreak || 0) / badge.requirement)
      
      // Award badge each time we reach a new "batch" of this requirement
      // E.g., if requirement is 3: earned at 3, 6, 9, 12, etc.
      if (currentMilestone > previousMilestone) {
        for (let i = previousMilestone + 1; i <= currentMilestone; i++) {
          badges.push({
            id: `${habit.id}-${badge.id}-${i}`,
            badgeId: badge.id,
            habitId: habit.id,
            habitName: habit.name,
            earnedAt: todayKey(),
            milestone: i,
          })
        }
      }
    })
  })

  // Points-based badges (global)
  BADGE_DEFINITIONS.filter(b => b.type === 'points').forEach((badge) => {
    if (points >= badge.requirement) {
      badges.push({
        id: `global-${badge.id}`,
        badgeId: badge.id,
        habitId: null,
        habitName: null,
        earnedAt: todayKey(),
      })
    }
  })

  return badges
}

const pickQuote = (category, customQuotes, daySeed) => {
  const source = category === 'gita' ? gitaQuotes : generalQuotes
  const combined = [...source, ...(customQuotes || [])]
  if (!combined.length) return 'Keep moving forward.'
  const idx = daySeed % combined.length
  return combined[idx]
}

const migrateData = (saved) => {
  if (!saved) return null
  const version = saved.schemaVersion || 1
  if (version < SCHEMA_VERSION) {
    const migrated = { ...saved, schemaVersion: SCHEMA_VERSION }
    if (version < 2) {
      migrated.habits = (migrated.habits || []).map((h) => ({
        ...h,
        isDailyHabit: h.targetDays ? false : true,
        habitColor: h.habitColor || getHabitColor(h.id),
        useGlobalGamification: true,
        customPoints: h.customPoints ?? 10,
        customStreakBonuses: h.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 },
      }))
      migrated.rewards = (migrated.rewards || []).map((r) => ({
        ...r,
        deleted: r.deleted ?? false,
      }))
    }
    if (version < 3) {
      migrated.habits = (migrated.habits || []).map((h) => ({
        ...h,
        goalType: h.goalType || 'binary',
        goalTarget: h.goalTarget || null,
        dailyValueHistory: h.dailyValueHistory || {},
      }))
    }
    if (version < 4) {
      migrated.rewards = (migrated.rewards || []).map((r) => ({
        ...r,
        claimed: false,
      }))
      migrated.claimedRewards = (migrated.claimedRewards || []).map((entry) => {
        const reward = (migrated.rewards || []).find((r) => r.id === entry.rewardId)
        return {
          ...entry,
          cost: entry.cost ?? reward?.requiredPoints ?? 0,
          name: entry.name ?? reward?.name ?? 'Reward',
        }
      })
    }
    if (version < 5) {
      migrated.earnedBadges = migrated.earnedBadges || []
      migrated.manualAdjustment = migrated.manualAdjustment || 0
      migrated.habits = (migrated.habits || []).map((h) => ({
        ...h,
        previousStreak: h.previousStreak ?? 0,
        streakMilestones: h.streakMilestones ?? {},
      }))
    }
    if (version < 6) {
      migrated.streakFreezes = migrated.streakFreezes ?? 0
      migrated.habits = (migrated.habits || []).map((h) => ({
        ...h,
        freezeDates: h.freezeDates ?? {},
      }))
    }
    return migrated
  }
  return saved
}

const createAppActions = ({ state, setState, points }) => {
  const addHabit = (data) => {
    const newHabit = {
      id: crypto.randomUUID(),
      history: {},
      createdAt: todayKey(),
      isDailyHabit: data.isDailyHabit ?? true,
      targetDays: data.isDailyHabit ? null : data.targetDays,
      habitColor: getHabitColor(crypto.randomUUID()),
      customPoints: data.customPoints ?? 10,
      customStreakBonuses: data.customStreakBonuses ?? { 3: 2, 7: 5, 30: 10 },
      goalType: data.goalType || 'binary',
      goalTarget: data.goalTarget || null,
      dailyValueHistory: {},
      previousStreak: 0,
      streakMilestones: {},
      ...data,
    }
    setState((prev) => ({ ...prev, habits: [...prev.habits, newHabit] }))
  }

  const updateHabit = (id, data) => {
    const configuration = pickHabitConfiguration(data)
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => (h.id === id ? { ...h, ...configuration } : h)),
    }))
  }

  const deleteHabit = (id) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== id),
    }))
  }

  const toggleCompletion = (id, dateKey = todayKey(), completed = true, value = null) => {
    setState((prev) => {
      let refund = 0
      const habits = prev.habits.map((habit) => {
        if (habit.id !== id) return habit

        const freezeDates = { ...(habit.freezeDates || {}) }
        const hadFreeze = freezeDates[dateKey] === true
        if (hadFreeze && completed === true) {
          delete freezeDates[dateKey]
          refund = 1
        }

        if (habit.goalType === 'binary') {
          const history = { ...(habit.history || {}) }
          history[dateKey] = completed
          return { ...habit, history, freezeDates }
        }

        const dailyValueHistory = { ...(habit.dailyValueHistory || {}) }
        if (value !== null) {
          dailyValueHistory[dateKey] = value
          const history = { ...(habit.history || {}) }
          history[dateKey] = value >= (habit.goalTarget || 1)
          return { ...habit, dailyValueHistory, history, freezeDates }
        }

        return { ...habit, freezeDates }
      })

      if (!refund) {
        return { ...prev, habits }
      }

      return {
        ...prev,
        habits,
        streakFreezes: (prev.streakFreezes || 0) + refund,
      }
    })
  }

  const addReward = (reward) => {
    setState((prev) => ({
      ...prev,
      rewards: [...prev.rewards, { id: crypto.randomUUID(), ...reward }],
    }))
  }

  const claimReward = (rewardId) => {
    const reward = state.rewards.find((r) => r.id === rewardId && !r.deleted)
    if (!reward) return
    const cost = reward.requiredPoints || 0
    if (points < cost) return

    setState((prev) => ({
      ...prev,
      claimedRewards: [
        ...prev.claimedRewards,
        { rewardId, claimedAt: todayKey(), cost, name: reward.name },
      ],
    }))
  }

  const buyStreakFreeze = () => {
    if (points < STREAK_FREEZE_COST) return
    setState((prev) => ({
      ...prev,
      streakFreezes: (prev.streakFreezes || 0) + 1,
      claimedRewards: [
        ...prev.claimedRewards,
        {
          rewardId: 'streak-freeze',
          claimedAt: todayKey(),
          cost: STREAK_FREEZE_COST,
          name: 'Streak Freeze',
        },
      ],
    }))
  }

  const useStreakFreeze = (habitId, dateKey = todayKey()) => {
    const today = todayKey()
    if (dateKey > today) return

    setState((prev) => {
      if ((prev.streakFreezes || 0) <= 0) return prev

      let used = false
      const habits = prev.habits.map((habit) => {
        if (habit.id !== habitId) return habit

        const freezeDates = { ...(habit.freezeDates || {}) }
        if (freezeDates[dateKey]) return habit

        const isCompleted = habit.goalType === 'binary'
          ? habit.history?.[dateKey] === true
          : (habit.dailyValueHistory?.[dateKey] ?? 0) >= (habit.goalTarget || 1)

        if (isCompleted) return habit

        freezeDates[dateKey] = true
        used = true
        return { ...habit, freezeDates }
      })

      if (!used) return prev

      return {
        ...prev,
        habits,
        streakFreezes: (prev.streakFreezes || 0) - 1,
      }
    })
  }

  const removeStreakFreeze = (habitId, dateKey = todayKey()) => {
    setState((prev) => {
      let removed = false
      const habits = prev.habits.map((habit) => {
        if (habit.id !== habitId) return habit

        const freezeDates = { ...(habit.freezeDates || {}) }
        if (!freezeDates[dateKey]) return habit

        delete freezeDates[dateKey]
        removed = true
        return { ...habit, freezeDates }
      })

      if (!removed) return prev

      return {
        ...prev,
        habits,
        streakFreezes: (prev.streakFreezes || 0) + 1,
      }
    })
  }

  const updateReward = (rewardId, data) => {
    setState((prev) => ({
      ...prev,
      rewards: prev.rewards.map((r) => (r.id === rewardId ? { ...r, ...data } : r)),
    }))
  }

  const deleteReward = (rewardId) => {
    setState((prev) => ({
      ...prev,
      rewards: prev.rewards.map((r) => (r.id === rewardId ? { ...r, deleted: true } : r)),
    }))
  }

  const addCustomQuote = (quote) => {
    if (!quote?.trim()) return
    setState((prev) => ({ ...prev, customQuotes: [...prev.customQuotes, quote.trim()] }))
  }

  const adjustMithura = (amount) => {
    setState((prev) => ({
      ...prev,
      manualAdjustment: (prev.manualAdjustment || 0) + amount,
    }))
  }

  const updateSettings = (partial) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }))
  }

  const updateHabitGamification = (habitId, useGlobal, customPoints, customStreakBonuses) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        h.id === habitId
          ? {
              ...h,
              useGlobalGamification: useGlobal,
              customPoints: useGlobal ? null : customPoints,
              customStreakBonuses: useGlobal ? null : customStreakBonuses,
            }
          : h,
      ),
    }))
  }

  return {
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    addReward,
    claimReward,
    updateReward,
    deleteReward,
    buyStreakFreeze,
    useStreakFreeze,
    removeStreakFreeze,
    addCustomQuote,
    updateSettings,
    updateHabitGamification,
    adjustMithura,
  }
}

export const AppProvider = ({ children }) => {
  localforage.config({ name: 'namami', storeName: 'state' }) // Keep storage location stable across releases

  const [state, setState] = useState({
    habits: defaultHabits,
    rewards: defaultRewards,
    settings: defaultSettings,
    customQuotes: [],
    claimedRewards: [],
    earnedBadges: [], // Track earned badges with habit and timestamp
    manualAdjustment: 0, // Track manual MITHURA adjustments
    streakFreezes: 0,
    schemaVersion: SCHEMA_VERSION,
  })
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const retryStorage = () => {
    setStorageError(null)
    setLoadAttempt(attempt => attempt + 1)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const saved = await loadStoredState(localforage, migrateData)
        if (!active) return
        if (saved !== null) setState(saved)
        setStorageError(null)
        // Only a successful read may enable saving or show the habit controls.
        setLoading(false)
      } catch (error) {
        if (active) setStorageError({ kind: 'load', message: error.message })
      }
    }
    load()
    return () => { active = false }
  }, [loadAttempt])

  useEffect(() => {
    if (!loading) {
      localforage.setItem(STORAGE_KEY, state)
    }
  }, [state, loading])

  // Apply theme to document
  useEffect(() => {
    const theme = state.settings?.theme === 'light' ? 'light' : 'dark'
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
  }, [state.settings?.theme])

  const { habits, points: lifetimePoints, bonusDays, globalStreak } = useMemo(
    () => deriveStats(state.habits, state.settings),
    [state.habits, state.settings],
  )

  const pointsSpent = useMemo(
    () => calculatePointsSpent(state.claimedRewards, state.rewards) + (state.manualAdjustment || 0),
    [state.claimedRewards, state.rewards, state.manualAdjustment],
  )

  const points = Math.max(0, lifetimePoints - pointsSpent)

  // Check for newly earned badges and update streak tracking
  useEffect(() => {
    if (loading || !habits.length) return

    // Keep existing badge/streak persistence; the updater returns prev when nothing changed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => {
      const newBadges = checkBadgesEarned(habits, points)
      const existingBadgeIds = new Set((prev.earnedBadges || []).map((b) => b.id))
      const badgesToAdd = newBadges.filter((b) => !existingBadgeIds.has(b.id))

      const updatedHabits = prev.habits.map((habit) => {
        const updated = habits.find((h) => h.id === habit.id)
        if (updated && updated.streak !== habit.previousStreak) {
          return { ...habit, previousStreak: updated.streak }
        }
        return habit
      })

      const hasStreakUpdates = updatedHabits.some((habit, idx) => habit !== prev.habits[idx])

      if (!badgesToAdd.length && !hasStreakUpdates) {
        return prev
      }

      return {
        ...prev,
        earnedBadges: badgesToAdd.length > 0 ? [...(prev.earnedBadges || []), ...badgesToAdd] : prev.earnedBadges,
        habits: hasStreakUpdates ? updatedHabits : prev.habits,
      }
    })
  }, [habits, points, loading])

  const quoteOfDay = useMemo(() => {
    const seed = Number(todayKey().replaceAll('-', ''))
    return pickQuote(state.settings.quoteCategory, state.customQuotes, seed)
  }, [state.settings.quoteCategory, state.customQuotes])

  const {
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    addReward,
    claimReward,
    updateReward,
    deleteReward,
    buyStreakFreeze,
    useStreakFreeze,
    removeStreakFreeze,
    addCustomQuote,
    updateSettings,
    updateHabitGamification,
    adjustMithura,
  } = createAppActions({ state, setState, points })

  const value = {
    loading,
    storageError,
    retryStorage,
    habits,
    points,
    lifetimePoints,
    pointsSpent,
    bonusDays,
    globalStreak,
    rewards: state.rewards.filter((r) => !r.deleted),
    settings: state.settings,
    customQuotes: state.customQuotes,
    quoteOfDay,
    claimedRewards: state.claimedRewards,
    earnedBadges: state.earnedBadges,
    badgeDefinitions: BADGE_DEFINITIONS,
    streakFreezes: state.streakFreezes || 0,
    streakFreezeCost: STREAK_FREEZE_COST,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    addReward,
    claimReward,
    updateReward,
    deleteReward,
    buyStreakFreeze,
    useStreakFreeze,
    removeStreakFreeze,
    addCustomQuote,
    updateSettings,
    updateHabitGamification,
    adjustMithura,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext)
