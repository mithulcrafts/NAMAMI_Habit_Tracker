import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { makeHabit, makeState, memoryStorage } from './fixtures'
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
afterEach(async () => { await act(async () => {}); vi.useRealTimers() })
it.each([[true, null, 100], [false, 24, 50]])('keeps ongoing=%s progress bounded and target %s progress correct', async (isDailyHabit, targetDays, expected) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  const history = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`2026-10-${i + 12}`, true]))
  Object.assign(localforage, memoryStorage({ 'namami-state-v1': makeState({ habits: [makeHabit({
    createdAt: '2026-10-12', history, freezeDates: {}, isDailyHabit, targetDays,
  })] }) }))
  const app = renderHook(useApp, { wrapper: ({ children }) => <AppProvider>{children}</AppProvider> })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  expect(app.result.current.habits[0].completionRate).toBe(expected)
  expect(app.result.current.habits[0].history).toEqual(history)
})
