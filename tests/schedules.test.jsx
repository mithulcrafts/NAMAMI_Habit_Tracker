import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { currentStreak, getHabitPeriods, getGlobalPeriods } from '../src/utils/schedule'
import { makeHabit, makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
const habit = partial => makeHabit({ createdAt: '2026-10-01', history: {}, freezeDates: {}, ...partial })
const streak = (h, today = '2026-10-23') => currentStreak(getHabitPeriods(h, today), today)

it('L01: skips unscheduled days and counts consecutive M/W/F completions', () => {
  const h = habit({ frequency: 'custom', customDays: [1, 3, 5], history: {
    '2026-10-19': true, '2026-10-21': true, '2026-10-23': true,
  } })
  expect(streak(h)).toBe(3)
  expect(streak(h, '2026-10-25')).toBe(3)
  expect(streak(h, '2026-10-26')).toBe(3)
  expect(streak(h, '2026-10-27')).toBe(0)
  expect(streak({ ...h, history: { ...h.history, '2026-10-21': false } })).toBe(1)
})
it('counts one weekly completion per week, including multiple logs in one week', () => {
  const h = habit({ frequency: 'weekly', history: {
    '2026-10-06': true, '2026-10-12': true, '2026-10-13': true, '2026-10-23': true,
  } })
  expect(streak(h)).toBe(3)
  expect(streak(h, '2026-10-30')).toBe(3) // This week is still open.
  expect(streak(h, '2026-11-01')).toBe(0) // A full week was missed.
})
it('preserves freeze behavior on scheduled days and weeks', () => {
  expect(streak(habit({ frequency: 'custom', customDays: [1, 3, 5],
    history: { '2026-10-19': true, '2026-10-23': true }, freezeDates: { '2026-10-21': true } }))).toBe(3)
  expect(streak(habit({ frequency: 'weekly', history: { '2026-10-06': true, '2026-10-23': true },
    freezeDates: { '2026-10-15': true } }))).toBe(3)
})
it('handles empty custom schedules and year boundaries without endless loops', () => {
  expect(streak(habit({ frequency: 'custom', customDays: [] }))).toBe(0)
  expect(streak(habit({ frequency: 'weekly', createdAt: '2025-12-20',
    history: { '2025-12-24': true, '2025-12-31': true, '2026-01-06': true } }), '2026-01-06')).toBe(3)
})
it('global daily bonus requires only the tasks due that day', () => {
  const periods = getGlobalPeriods([
    habit({ id: 'daily', history: { '2026-10-20': true } }),
    habit({ id: 'mwf', frequency: 'custom', customDays: [1, 3, 5] }),
  ], '2026-10-20')
  expect(periods.at(-1).completed).toBe(true)
  expect(periods.at(-1).habitIds).toEqual(['daily'])
})
it('L02: adding a habit today cannot remove a past all-tasks bonus', () => {
  const old = habit({ id: 'old', history: { '2026-10-22': true } })
  const newHabit = habit({ id: 'new', createdAt: '2026-10-23' })
  const before = getGlobalPeriods([old], '2026-10-23').filter(p => p.completed)
  const after = getGlobalPeriods([old, newHabit], '2026-10-23').filter(p => p.completed)
  expect(after).toEqual(before)
})
it('weekly tasks are due once at week end and an earlier completion satisfies them', () => {
  const h = habit({ frequency: 'weekly', history: { '2026-10-20': true } })
  const periods = getGlobalPeriods([h], '2026-10-24')
  expect(periods.at(-1)).toMatchObject({ key: '2026-10-24', completed: true })
  expect(periods.some(p => p.key === '2026-10-20')).toBe(false)
})
it('provider preserves all raw logs, amounts, freezes, and unknown fields while deriving schedules', async () => {
  const raw = makeState({ habits: [habit({ frequency: 'weekly', history: { '2026-10-06': true } })] })
  const storage = memoryStorage({ 'namami-state-v1': raw })
  Object.assign(localforage, storage)
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  const saved = storage.records.get('namami-state-v1')
  expect(saved.habits[0].history).toEqual(raw.habits[0].history)
  expect(saved.habits[0].dailyValueHistory).toEqual(raw.habits[0].dailyValueHistory)
  expect(saved.habits[0].freezeDates).toEqual(raw.habits[0].freezeDates)
  expect(saved.claimedRewards).toEqual(raw.claimedRewards)
  expect(saved.manualAdjustment).toBe(raw.manualAdjustment)
  expect(saved.extraStateField).toEqual(raw.extraStateField)
})
