import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import localforage from 'localforage'
import { generalQuotes, gitaQuotes } from '../data/quotes'
import {
  formatDate,
  todayKey,
} from '../utils/date'

import { loadStoredState, STORAGE_KEY } from '../utils/stateStorage'
import { pickHabitConfiguration } from '../utils/habitConfiguration'
import { openEditingSession } from '../utils/editingSession'
import { isValidRewardCost, isValidScoringPatch } from '../utils/scoringValidation'
import { isHabitCompletedOnDate } from '../utils/habitProgress'
import { useToday } from '../hooks/useToday'
import { currentStreak, getHabitPeriods, getGlobalPeriods } from '../utils/schedule'
import { initializeStreakEarnings, reconcileStreakEarnings, earnedStreakPoints } from '../utils/streakEarnings'
import { legacyStats } from '../utils/legacyScoring'
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

const deriveStats = (habits, settings, today = todayKey(), journal) => {
  const enriched = habits.map((habit) => {
    const streak = currentStreak(getHabitPeriods(habit, today), today)

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

  const globalPeriods = getGlobalPeriods(enriched, today)
  const bonusDays = globalPeriods.filter(period => period.completed).map(period => period.key)

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

  const globalStreak = settings.gamificationEnabled ? currentStreak(globalPeriods, today) : 0

  const globalStreakBonus = settings.gamificationEnabled
    ? (() => {
        const bonuses = settings.globalStreakBonuses ?? { 3: 5, 7: 10, 30: 20 }
        if (globalStreak >= 30) return bonuses[30] || 0
        if (globalStreak >= 7) return bonuses[7] || 0
        if (globalStreak >= 3) return bonuses[3] || 0
        return 0
      })()
    : 0

  const currentBonus = perHabitStreakBonus + globalStreakBonus
  const nonStreakPoints = basePoints + dailyBonusPoints
  const totalPoints = nonStreakPoints + (journal ? earnedStreakPoints(journal) : currentBonus)

  return {
    habits: enriched,
    points: totalPoints,
    currentBonus,
    nonStreakPoints,
    bonusDays,
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

const prepareEarnings = (saved) => {
  if (saved.streakEarnings) return saved
  const current = deriveStats(saved.habits, saved.settings)
  const releasedPoints = legacyStats(saved.habits, saved.settings).points
  // Keep any balance that the released app would display. Historical award
  // amounts were not stored, so do not invent retroactive milestone payments.
  const opening = Math.max(current.currentBonus, releasedPoints - current.nonStreakPoints, 0)
  return initializeStreakEarnings(saved, opening)
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
    return prepareEarnings(migrated)
  }
  return prepareEarnings(saved)
}

const createAppActions = ({ state, setState, points }) => {
  const addHabit = (data) => {
    if (!isValidScoringPatch(data)) return
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
    if (!isValidScoringPatch(configuration)) return
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
        // Validate before changing either progress or freeze inventory.
        if (habit.goalType !== 'binary' && (!Number.isFinite(value) || value < 0)) return habit

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
    if (!isValidRewardCost(reward.requiredPoints)) return
    setState((prev) => ({
      ...prev,
      rewards: [...prev.rewards, { id: crypto.randomUUID(), ...reward }],
    }))
  }

  const claimReward = (rewardId) => {
    const reward = state.rewards.find((r) => r.id === rewardId && !r.deleted)
    if (!reward) return
    const cost = reward.requiredPoints
    if (!isValidRewardCost(cost)) return
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

        const isCompleted = isHabitCompletedOnDate(habit, dateKey)

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
    if (Object.hasOwn(data, 'requiredPoints') && !isValidRewardCost(data.requiredPoints)) return
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
    if (!Number.isFinite(amount)) return
    setState((prev) => ({
      ...prev,
      manualAdjustment: (prev.manualAdjustment || 0) + amount,
    }))
  }

  const updateSettings = (partial) => {
    if (!isValidScoringPatch(partial)) return
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }))
  }

  const updateHabitGamification = (habitId, useGlobal, customPoints, customStreakBonuses) => {
    if (!useGlobal && !isValidScoringPatch({ customPoints, customStreakBonuses })) return
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
  const today = useToday()
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
  const [saveAttempt, setSaveAttempt] = useState(0)
  const saveQueue = useRef(Promise.resolve())
  const loadQueue = useRef(Promise.resolve())
  const editingSession = useRef(null)
  const lastSaved = useRef(null)
  const retryStorage = async () => {
    if (loading) {
      setStorageError(null)
      setLoadAttempt(attempt => attempt + 1)
    } else {
      // A suspended fallback owner may have lost its lease. Never save its old
      // state over changes made by the replacement owner.
      if (storageError?.kind === 'locked' || storageError?.kind === 'conflict') {
        let replacement
        try {
          await saveQueue.current
          replacement = await openEditingSession(localforage)
          const current = await localforage.getItem(STORAGE_KEY)
          if (JSON.stringify(current) !== lastSaved.current) {
            await replacement.release()
            setStorageError({ kind: 'conflict', message: 'Another copy saved changes while this tab was inactive. Download this tab’s changes before closing it; the newer saved data has been left untouched.' })
            return
          }
          await editingSession.current?.release()
          editingSession.current = replacement
        } catch (error) {
          await replacement?.release()
          setStorageError({ kind: 'locked', message: error.message })
          return
        }
      }
      // Retry the in-memory changes, never reload over an unsaved check-in.
      setSaveAttempt(attempt => attempt + 1)
    }
  }
  const downloadRecovery = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'namami-unsaved-recovery.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        if (!active) return
        const session = await openEditingSession(localforage)
        if (!active) { await session.release(); return }
        editingSession.current = session
        const saved = await loadStoredState(localforage, migrateData)
        lastSaved.current = JSON.stringify(await localforage.getItem(STORAGE_KEY))
        if (!active) return
        if (saved !== null) setState(saved)
        else setState(previous => prepareEarnings(previous))
        setStorageError(null)
        // Only a successful read may enable saving or show the habit controls.
        setLoading(false)
      } catch (error) {
        await editingSession.current?.release().catch(() => {})
        editingSession.current = null
        if (active) setStorageError({ kind: error.name === 'StorageBusyError' ? 'locked' : 'load', message: error.message })
      }
    }
    // StrictMode can start and cancel a load immediately. Complete its release
    // before acquiring the next session, so it cannot lock itself out.
    loadQueue.current = loadQueue.current.then(load)
    return () => {
      active = false
      loadQueue.current = loadQueue.current.then(async () => {
        await saveQueue.current
        await editingSession.current?.release().catch(() => {})
        editingSession.current = null
      })
    }
  }, [loadAttempt])

  useEffect(() => {
    if (loading) return
    let active = true
    const renew = () => editingSession.current?.renew().catch(error => {
      if (active) setStorageError({ kind: 'locked', message: error.message })
    })
    const relinquish = () => {
      // Best effort for older browsers; expiry also recovers an abrupt close.
      saveQueue.current.then(() => editingSession.current?.release()).catch(() => {})
    }
    const timer = setInterval(renew, 5000)
    window.addEventListener('focus', renew)
    window.addEventListener('pagehide', relinquish)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', renew)
      window.removeEventListener('pagehide', relinquish)
    }
  }, [loading])

  useEffect(() => {
    if (loading) return
    let active = true
    // Preserve write order even when IndexedDB is slow. Every queued snapshot
    // includes earlier edits; an old save must never finish after a newer save.
    saveQueue.current = saveQueue.current
      .then(() => editingSession.current.save(state))
      .then(() => {
        lastSaved.current = JSON.stringify(state)
        if (active) setStorageError(null)
      })
      .catch((error) => {
        if (active) setStorageError({ kind: error.name === 'StorageBusyError' ? 'locked' : 'save', message: error.message })
      })
    return () => { active = false }
  }, [state, loading, saveAttempt])

  // Apply theme to document
  useEffect(() => {
    const theme = state.settings?.theme === 'light' ? 'light' : 'dark'
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
  }, [state.settings?.theme])

  const { habits, points: lifetimePoints, bonusDays, globalStreak } = useMemo(
    () => deriveStats(state.habits, state.settings, today, state.streakEarnings),
    [state.habits, state.settings, state.streakEarnings, today],
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
        return reconcileStreakEarnings(prev, prev, today)
      }

      return {
        ...reconcileStreakEarnings(prev, prev, today),
        earnedBadges: badgesToAdd.length > 0 ? [...(prev.earnedBadges || []), ...badgesToAdd] : prev.earnedBadges,
        habits: hasStreakUpdates ? updatedHabits : prev.habits,
      }
    })
  }, [habits, points, loading, today])

  const quoteOfDay = useMemo(() => {
    const seed = Number(today.replaceAll('-', ''))
    return pickQuote(state.settings.quoteCategory, state.customQuotes, seed)
  }, [state.settings.quoteCategory, state.customQuotes, today])

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
  } = createAppActions({ state, points, setState: updater => setState(previous => {
    const next = typeof updater === 'function' ? updater(previous) : updater
    return reconcileStreakEarnings(previous, next)
  }) })

  const value = {
    loading,
    storageError,
    retryStorage,
    downloadRecovery,
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
