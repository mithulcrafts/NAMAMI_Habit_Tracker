import { StrictMode } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import localforage from 'localforage'
import { AppProvider, useApp } from '../src/context/AppContext'
import App from '../src/App'
import { makeState, memoryStorage } from './fixtures'

vi.mock('localforage', () => ({ default: { config: vi.fn(), getItem: vi.fn(), setItem: vi.fn() } }))
const KEY = 'namami-state-v1'
let storage
const wrapper = ({ children }) => <StrictMode><AppProvider>{children}</AppProvider></StrictMode>
beforeEach(() => {
  storage = memoryStorage({ [KEY]: makeState() })
  Object.assign(localforage, storage)
  let occupied = false
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: async (_name, _options, callback) => {
      if (occupied) return callback(null)
      occupied = true
      try { return await callback({}) } finally { occupied = false }
    },
  } })
})
afterEach(() => { delete navigator.locks })

it('D03: prevents the second provider from loading editable stale data or saving', async () => {
  const a = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(a.result.current.loading).toBe(false))
  const b = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(b.result.current.storageError?.kind).toBe('locked'))
  expect(b.result.current.loading).toBe(true)
  act(() => a.result.current.toggleCompletion('real-habit', '2020-01-04', true))
  await waitFor(() => expect(storage.records.get(KEY).habits[0].history['2020-01-04']).toBe(true))
  const saved = structuredClone(storage.records.get(KEY))
  // Even direct calls while the UI is blocked must not enable persistence.
  act(() => b.result.current.updateSettings({ theme: 'dark' }))
  await act(async () => {})
  expect(storage.records.get(KEY)).toEqual(saved)
  a.unmount()
  await act(async () => {})
  await act(async () => b.result.current.retryStorage())
  await waitFor(() => expect(b.result.current.loading).toBe(false))
  expect(b.result.current.habits[0].history['2020-01-04']).toBe(true)
  expect(b.result.current.settings.theme).toBe('light')
})

it('shows an already-open message and Retry, without editable controls', async () => {
  const owner = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(owner.result.current.loading).toBe(false))
  render(<StrictMode><App /></StrictMode>)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByText(/already open for editing/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Home' })).toBeNull()
  owner.unmount()
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'Home' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('releases the editing lock if loading fails so another copy can retry safely', async () => {
  const read = storage.getItem.getMockImplementation()
  storage.getItem.mockRejectedValue(new Error('Unavailable'))
  const a = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(a.result.current.storageError?.kind).toBe('load'))
  storage.getItem.mockImplementation(read)
  const b = renderHook(() => useApp(), { wrapper })
  await waitFor(() => expect(b.result.current.loading).toBe(false))
  expect(b.result.current.habits[0].name).toBe('My existing habit')
})
