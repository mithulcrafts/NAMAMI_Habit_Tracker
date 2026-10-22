import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { openEditingSession } from '../src/utils/editingSession'
import { deferred, makeState } from './fixtures'

let idb, storage, now
const config = { name: 'namami', storeName: 'state' }
const transaction = async (mode, run) => {
  const db = await new Promise((resolve, reject) => {
    const req = idb.open(config.name)
    req.onupgradeneeded = () => req.result.createObjectStore(config.storeName)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(config.storeName, mode)
      const req = run(tx.objectStore(config.storeName))
      tx.oncomplete = () => resolve(req.result)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
const open = () => openEditingSession(storage, { locks: undefined, indexedDB: idb, now: () => now })
beforeEach(async () => {
  idb = new IDBFactory()
  now = 100000
  storage = {
    config: () => config, ready: async () => {}, driver: () => 'asyncStorage', INDEXEDDB: 'asyncStorage',
    setItem: vi.fn((key, value) => transaction('readwrite', store => store.put(value, key))),
    getItem: key => transaction('readonly', store => store.get(key)),
  }
  await storage.setItem('namami-state-v1', makeState())
})

it('allows only one writer even when two tabs open at the same time', async () => {
  const results = await Promise.allSettled([open(), open()])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(results.find(r => r.status === 'rejected').reason.name).toBe('StorageBusyError')
  await results.find(r => r.status === 'fulfilled').value.release()
})

it('allows another tab after normal release and leaves user data untouched', async () => {
  const a = await open()
  await expect(open()).rejects.toThrow('already open')
  await a.release()
  const b = await open()
  expect(await storage.getItem('namami-state-v1')).toEqual(makeState())
  await b.release()
})

it('a crashed/suspended owner cannot overwrite a replacement owner after its lease expires', async () => {
  const a = await open()
  now += 31000
  const b = await open()
  const latest = makeState({ customQuotes: ['Saved in B'] })
  await b.save(latest)
  await expect(a.save(makeState())).rejects.toThrow('already open')
  await expect(a.renew()).rejects.toThrow('already open')
  await a.release()
  await expect(open()).rejects.toThrow('already open')
  expect(await storage.getItem('namami-state-v1')).toEqual(latest)
  await b.release()
})

it('renewing the lease keeps an active tab editable', async () => {
  const a = await open()
  now += 20000
  await a.renew()
  now += 20000
  await expect(open()).rejects.toThrow('already open')
  await a.save(makeState({ manualAdjustment: 10 }))
  expect((await storage.getItem('namami-state-v1')).manualAdjustment).toBe(10)
  await a.release()
})

it('keeps Web Locks until the editable tab releases them', async () => {
  let occupied = false
  const locks = { request: async (_name, _options, callback) => {
    if (occupied) return callback(null)
    occupied = true
    try { return await callback({}) } finally { occupied = false }
  } }
  const a = await openEditingSession(storage, { locks })
  await expect(openEditingSession(storage, { locks })).rejects.toThrow('already open')
  const pending = deferred()
  const save = storage.setItem.getMockImplementation()
  storage.setItem.mockImplementation(async (key, value) => { await pending.promise; return save(key, value) })
  const saving = a.save(makeState({ manualAdjustment: 20 }))
  pending.resolve()
  await saving
  await a.release()
  const b = await openEditingSession(storage, { locks })
  await b.release()
})

it('does not permit unsafe writes when neither coordination mechanism is available', async () => {
  storage.driver = () => 'localStorageWrapper'
  await expect(open()).rejects.toThrow('cannot safely coordinate')
  expect(await storage.getItem('namami-state-v1')).toEqual(makeState())
})
