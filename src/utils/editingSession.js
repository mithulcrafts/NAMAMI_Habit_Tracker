import { STORAGE_KEY } from './stateStorage'

const LOCK_NAME = 'namami-edit-session'
const LOCK_KEY = 'namami-edit-session-lock'
const LEASE_MS = 30000

export class StorageBusyError extends Error {
  constructor() {
    super('NAMAMI is already open for editing in another tab or window. Close that copy, then retry. After a browser closes unexpectedly, recovery can take up to 30 seconds.')
    this.name = 'StorageBusyError'
  }
}

const nativeSession = (storage, locks) => new Promise((resolve, reject) => {
  const requested = locks.request(LOCK_NAME, { ifAvailable: true, mode: 'exclusive' }, async lock => {
    if (!lock) { reject(new StorageBusyError()); return }
    let active = true
    let release
    const held = new Promise(done => { release = done })
    resolve({
      async save(state) {
        if (!active) throw new StorageBusyError()
        await storage.setItem(STORAGE_KEY, state)
      },
      async renew() { if (!active) throw new StorageBusyError() },
      async release() { active = false; release(); await requested },
    })
    await held
  })
  requested.catch(reject)
})

// Older browsers may lack Web Locks. Coordinate them using a lease in the
// SAME IndexedDB store, checking ownership atomically with every state write.
// A suspended or crashed tab can never write after another tab takes ownership.
const indexedDBSession = async (storage, indexedDB, now) => {
  const config = storage.config()
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(config.name)
    request.onupgradeneeded = () => { request.transaction.abort() }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Browser storage is busy. Close other copies and retry.'))
  })
  const owner = crypto.randomUUID()
  let closed = false
  db.onversionchange = () => { closed = true; db.close() }
  const transact = (action, state) => new Promise((resolve, reject) => {
    if (closed) { reject(new StorageBusyError()); return }
    let failure
    const transaction = db.transaction(config.storeName, 'readwrite')
    const store = transaction.objectStore(config.storeName)
    const request = store.get(LOCK_KEY)
    request.onsuccess = () => {
      const lock = request.result
      if (action === 'release') {
        if (lock?.owner === owner) store.delete(LOCK_KEY)
        return
      }
      const available = !lock || lock.expiresAt <= now()
      if (action === 'acquire' ? !available : lock?.owner !== owner) {
        failure = new StorageBusyError()
        transaction.abort()
        return
      }
      store.put({ owner, expiresAt: now() + LEASE_MS }, LOCK_KEY)
      if (action === 'save') store.put(state, STORAGE_KEY)
    }
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(failure || transaction.error || new Error('Storage transaction was interrupted.'))
    transaction.onerror = () => { /* onabort reports the failure */ }
  })
  try { await transact('acquire') } catch (error) { db.close(); throw error }
  return {
    save: state => transact('save', state),
    renew: () => transact('renew'),
    async release() {
      if (closed) return
      try { await transact('release') } finally { closed = true; db.close() }
    },
  }
}

export const openEditingSession = async (storage, {
  locks = globalThis.navigator?.locks,
  indexedDB = globalThis.indexedDB,
  now = Date.now,
} = {}) => {
  if (locks?.request) return nativeSession(storage, locks)
  await storage.ready()
  if (storage.driver() === storage.INDEXEDDB && indexedDB) return indexedDBSession(storage, indexedDB, now)
  // Do not silently fall back to uncoordinated whole-state writes.
  throw new Error('This browser cannot safely coordinate app storage. Your saved data has not been changed. Retry when browser storage is available.')
}
