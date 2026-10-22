import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { deferred, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
const KEY = 'namami-state-v1'
const wrapper = ({ children }) => <StrictMode><AppProvider>{children}</AppProvider></StrictMode>
let storage
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
})
const mount = () => renderHook(() => useApp(), { wrapper })
const ready = async (app) => waitFor(() => expect(app.result.current.loading).toBe(false))

describe('D01: successful hydration is required before saving', () => {
  it('leaves existing data untouched when reading fails; retry loads it', async () => {
    const original = structuredClone(storage.records.get(KEY))
    storage.getItem.mockRejectedValue(new Error('Read unavailable'))
    const app = mount()
    await waitFor(() => expect(app.result.current.storageError).toBeTruthy())
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.records.get(KEY)).toEqual(original)
    storage.getItem.mockImplementation(async key => structuredClone(storage.records.get(key) ?? null))
    await act(async () => app.result.current.retryStorage())
    await ready(app)
    expect(app.result.current.habits[0].name).toBe(original.habits[0].name)
    expect(app.result.current.storageError).toBeNull()
    expect(storage.records.get(KEY)).toEqual({ ...original, habits: original.habits.map(h => ({ ...h, streakMilestones: { ...h.streakMilestones, badgePeriods: [], badgeCoverage: [] } })), streakEarnings: expect.objectContaining({ version: 1 }) })
  })

  it('does not write while the initial read is pending', async () => {
    const read = deferred()
    storage.getItem.mockReturnValue(read.promise)
    const app = mount()
    await act(async () => { await Promise.resolve() })
    expect(storage.setItem).not.toHaveBeenCalled()
    await act(async () => read.resolve(makeState()))
    await ready(app)
  })

  it('does not write after unmount during a pending read', async () => {
    const read = deferred()
    storage.getItem.mockReturnValue(read.promise)
    const app = mount()
    app.unmount()
    await act(async () => read.resolve(makeState()))
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it.each([false, '', [], {}, { ...makeState(), habits: {} },
    { ...makeState(), settings: null }, { ...makeState(), schemaVersion: 99 },
    { ...makeState(), schemaVersion: '6' }, { ...makeState(), claimedRewards: {} },
    { ...makeState(), habits: [{ id: 'h', name: 'H', history: [] }] },
  ])('does not overwrite an unreadable or unsupported record (%#)', async record => {
    storage.records.set(KEY, record)
    const app = mount()
    await waitFor(() => expect(app.result.current.storageError).toBeTruthy())
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.records.get(KEY)).toEqual(record)
  })

  it.each([1, 2, 3, 4, 5, 6])('preserves existing data from schema %i', async version => {
    const original = makeState({ schemaVersion: version })
    storage.records.set(KEY, original)
    const app = mount()
    await ready(app)
    await waitFor(() => expect(storage.records.get(KEY).schemaVersion).toBe(6))
    const saved = storage.records.get(KEY)
    for (const field of ['customQuotes', 'claimedRewards', 'earnedBadges', 'manualAdjustment', 'streakFreezes', 'settings', 'extraStateField']) {
      expect(saved[field]).toEqual(original[field])
    }
    for (const field of ['id', 'name', 'history', 'dailyValueHistory', 'freezeDates', 'createdAt', 'extraHabitField']) {
      expect(saved.habits[0][field]).toEqual(original.habits[0][field])
    }
    if (version < 6) {
      expect([...storage.records.entries()].some(([key, value]) => key.startsWith('namami-recovery:') && JSON.stringify(value) === JSON.stringify(original))).toBe(true)
    }
    const afterFirstLoad = structuredClone(saved)
    app.unmount()
    const reopened = mount()
    await ready(reopened)
    expect(storage.records.get(KEY)).toEqual(afterFirstLoad)
  })

  it('keeps a deliberately empty habit list empty', async () => {
    storage.records.set(KEY, makeState({ habits: [] }))
    const app = mount()
    await ready(app)
    expect(app.result.current.habits).toEqual([])
    expect(storage.records.get(KEY).habits).toEqual([])
  })

  it('seeds samples only after all keys were successfully read as absent', async () => {
    storage.records.clear()
    const app = mount()
    await ready(app)
    await waitFor(() => expect(storage.records.has(KEY)).toBe(true))
    expect(storage.records.get(KEY).habits[0].name).toBe('Morning Walk')
    expect(storage.getItem).toHaveBeenCalledWith('namami-state')
  })

  it('preserves the fallback key and verifies a recovery copy before promotion', async () => {
    const original = makeState()
    storage.records.delete(KEY)
    storage.records.set('namami-state', original)
    const app = mount()
    await ready(app)
    await waitFor(() => expect(storage.records.get(KEY)).toEqual({ ...original, habits: original.habits.map(h => ({ ...h, streakMilestones: { ...h.streakMilestones, badgePeriods: [], badgeCoverage: [] } })), streakEarnings: expect.objectContaining({ version: 1 }) }))
    expect(storage.records.get('namami-state')).toEqual(original)
    expect([...storage.records.keys()].some(key => key.startsWith('namami-recovery:'))).toBe(true)
  })

  it.each(['write', 'verification'])('leaves legacy data intact when recovery %s fails', async failure => {
    const original = makeState({ schemaVersion: 3 })
    storage.records.set(KEY, original)
    if (failure === 'write') storage.setItem.mockRejectedValue(new Error('Quota exceeded'))
    else storage.getItem.mockImplementation(async key => key.startsWith('namami-recovery:') ? null : structuredClone(storage.records.get(key) ?? null))
    const app = mount()
    await waitFor(() => expect(app.result.current.storageError).toBeTruthy())
    expect(storage.records.get(KEY)).toEqual(original)
    expect(storage.setItem.mock.calls.some(([key]) => key === KEY)).toBe(false)
  })
})

it('blocks conflicting primary/protected copies on startup and makes both available for recovery', async () => {
  const primary = makeState({ customQuotes: ['Old app changed this'] })
  const protectedCopy = makeState({ customQuotes: ['New app saved this'] })
  storage.records.set(KEY, primary)
  storage.records.set('namami-state-v1-protected', protectedCopy)
  const app = mount()
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('load'))
  expect(app.result.current.storageError.recovery).toEqual({ current: primary, protectedCopy })
  expect(storage.setItem).not.toHaveBeenCalled()
  expect(storage.records.get(KEY)).toEqual(primary)
  expect(storage.records.get('namami-state-v1-protected')).toEqual(protectedCopy)
})
