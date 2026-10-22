import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { vi } from 'vitest'

export const createWorker = async () => {
  const origin = 'https://namami.example'
  const stores = new Map(), listeners = new Map()
  const keyOf = request => new URL(typeof request === 'string' ? request : request.url, origin).href
  const caches = {
    open: vi.fn(async name => {
      if (!stores.has(name)) stores.set(name, new Map())
      const records = stores.get(name)
      return {
        match: vi.fn(async request => records.get(keyOf(request))?.clone()),
        put: vi.fn(async (request, response) => { records.set(keyOf(request), response.clone()) }),
        addAll: vi.fn(async paths => { for (const path of paths) records.set(keyOf(path), new Response('precache shell', { headers: { 'content-type': 'text/html' } })) }),
      }
    }),
    match: vi.fn(async request => {
      for (const records of stores.values()) if (records.has(keyOf(request))) return records.get(keyOf(request)).clone()
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async name => stores.delete(name)),
  }
  const fetch = vi.fn(async () => { throw new Error('Offline') })
  const self = { location: { origin }, clients: { claim: vi.fn(async () => {}) }, skipWaiting: vi.fn(async () => {}),
    addEventListener: (name, handler) => listeners.set(name, handler) }
  const context = vm.createContext({ self, caches, fetch, URL, Response, console })
  vm.runInContext(readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8'), context)
  const lifecycle = async name => {
    const pending = []
    listeners.get(name)?.({ waitUntil: promise => pending.push(promise) })
    await Promise.all(pending)
  }
  await lifecycle('install')
  const request = async (path = '/', options = {}) => {
    const pending = []
    let response
    listeners.get('fetch')({ request: { url: keyOf(path), method: 'GET', mode: 'navigate',
      headers: new Headers({ accept: 'text/html' }), destination: 'document', ...options },
      respondWith: promise => { response = promise }, waitUntil: promise => pending.push(promise) })
    const result = await response
    await Promise.all(pending)
    return result
  }
  return { caches, stores, fetch, self, listeners, lifecycle, request }
}
