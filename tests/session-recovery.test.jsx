import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import { openEditingSession } from '../src/utils/editingSession'
import { makeState, memoryStorage } from './fixtures'

vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
vi.mock('../src/utils/editingSession', () => ({ openEditingSession: vi.fn() }))
let storage, sessions
const KEY = 'namami-state-v1'
const busy = () => Object.assign(new Error('Another editor owns storage'), { name: 'StorageBusyError' })
const wrapper = ({ children }) => <AppProvider>{children}</AppProvider>
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
  sessions = []
  openEditingSession.mockImplementation(async () => {
    const session = { save: vi.fn(state => storage.setItem(KEY, state)), renew: vi.fn(async () => {}), release: vi.fn(async () => {}) }
    sessions.push(session)
    return session
  })
})

it('reacquires ownership without losing unsaved edits when the saved version is unchanged', async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  sessions[0].save.mockRejectedValue(busy())
  act(() => app.result.current.updateHabit('real-habit', { name: 'Unsaved' }))
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('locked'))
  await act(async () => app.result.current.retryStorage())
  await waitFor(() => expect(storage.records.get(KEY).habits[0].name).toBe('Unsaved'))
  expect(app.result.current.storageError).toBeNull()
})

it('keeps both versions intact when another editor has saved since ownership was lost', async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  sessions[0].save.mockRejectedValue(busy())
  act(() => app.result.current.updateHabit('real-habit', { name: 'Unsaved' }))
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('locked'))
  const latest = makeState({ customQuotes: ['Saved in another tab'] })
  storage.records.set(KEY, latest)
  await act(async () => app.result.current.retryStorage())
  expect(app.result.current.storageError?.kind).toBe('conflict')
  expect(storage.records.get(KEY)).toEqual(latest)
  expect(app.result.current.habits[0].name).toBe('Unsaved')
  expect(sessions[1].release).toHaveBeenCalled()
  expect(sessions[1].save).not.toHaveBeenCalled()
})
