import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import App from '../src/App'
import { todayKey } from '../src/utils/date'
import { deferred, makeState, memoryStorage } from './fixtures'

vi.mock('../src/utils/editingSession', () => ({ openEditingSession: async storage => ({
  save: state => storage.setItem('namami-state-v1', state), renew: async () => {}, release: async () => {},
}) }))
vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
const KEY = 'namami-state-v1'
let storage
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
})
const wrapper = ({ children }) => <StrictMode><AppProvider>{children}</AppProvider></StrictMode>

it('D04: reports a failed save and retries the unsaved state without reloading it', async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  const persisted = structuredClone(storage.records.get(KEY))
  const save = storage.setItem.getMockImplementation()
  storage.setItem.mockRejectedValue(new Error('Quota exceeded'))
  act(() => app.result.current.toggleCompletion('real-habit', '2020-01-04', true))
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('save'))
  expect(app.result.current.habits[0].history['2020-01-04']).toBe(true)
  expect(storage.records.get(KEY)).toEqual(persisted)
  storage.setItem.mockImplementation(save)
  await act(async () => app.result.current.retryStorage())
  await waitFor(() => expect(storage.records.get(KEY).habits[0].history['2020-01-04']).toBe(true))
  expect(app.result.current.storageError).toBeNull()
})

it('serializes delayed saves so an older snapshot cannot finish last', async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  const pending = deferred()
  const save = storage.setItem.getMockImplementation()
  let writes = 0
  storage.setItem.mockImplementation(async (key, value) => {
    writes += 1
    if (writes === 1) await pending.promise
    return save(key, value)
  })
  act(() => app.result.current.updateHabit('real-habit', { name: 'First edit' }))
  await waitFor(() => expect(writes).toBe(1))
  act(() => app.result.current.updateSettings({ theme: 'dark' }))
  await act(async () => {})
  expect(writes).toBe(1)
  await act(async () => pending.resolve())
  await waitFor(() => expect(storage.records.get(KEY).settings.theme).toBe('dark'))
  expect(storage.records.get(KEY).habits[0].name).toBe('First edit')
})

it('keeps later edits when a failed save is retried', async () => {
  const app = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(app.result.current.loading).toBe(false))
  await act(async () => {})
  const save = storage.setItem.getMockImplementation()
  storage.setItem.mockRejectedValue(new Error('Unavailable'))
  act(() => app.result.current.updateHabit('real-habit', { name: 'Unsaved name' }))
  await waitFor(() => expect(app.result.current.storageError?.kind).toBe('save'))
  act(() => app.result.current.updateSettings({ theme: 'dark' }))
  await act(async () => {})
  storage.setItem.mockImplementation(save)
  await act(async () => app.result.current.retryStorage())
  await waitFor(() => expect(storage.records.get(KEY).settings.theme).toBe('dark'))
  expect(storage.records.get(KEY).habits[0].name).toBe('Unsaved name')
})

it('shows the approved save-error message and Retry in the app', async () => {
  render(<StrictMode><App /></StrictMode>)
  await screen.findByRole('button', { name: 'Home' })
  await act(async () => {})
  const save = storage.setItem.getMockImplementation()
  storage.setItem.mockRejectedValue(new Error('Unavailable'))
  fireEvent.click(screen.getByRole('button', { name: /mark done today/i }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy()
  storage.setItem.mockImplementation(save)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(storage.records.get(KEY).habits[0].history[todayKey()]).toBe(true)
})
