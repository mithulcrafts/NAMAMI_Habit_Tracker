// These identifiers are part of the installed app's data compatibility contract.
export const STORAGE_KEY = 'namami-state-v1'
export const PROTECTED_KEY = 'namami-state-v1-protected'
export class StorageConflictError extends Error {
  constructor(current, protectedCopy) {
    super('Another app version changed the saved data. Both saved copies have been kept. Download the recovery copies before making further changes; do not clear site data.')
    this.name = 'StorageConflictError'
    this.recovery = { current, protectedCopy }
  }
}
const STORAGE_KEYS = [STORAGE_KEY, 'namami-state']
const SCHEMA_VERSION = 6
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const validateStoredState = (saved) => {
  if (!isRecord(saved)) throw new Error('The saved record cannot be read safely.')
  const version = saved.schemaVersion ?? 1
  if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
    throw new Error('This saved record uses an unsupported version. Keep your data and use the latest app.')
  }
  if (!Array.isArray(saved.habits) || !Array.isArray(saved.rewards) || !isRecord(saved.settings)) {
    throw new Error('The saved record is incomplete. It has not been replaced.')
  }
  for (const key of ['claimedRewards', 'customQuotes', 'earnedBadges']) {
    if (saved[key] !== undefined && !Array.isArray(saved[key])) throw new Error(`Cannot read saved ${key}.`)
  }
  if (saved.streakEarnings !== undefined) {
    const journal = saved.streakEarnings
    if (!isRecord(journal) || journal.version !== 1 || !Number.isFinite(journal.opening) || journal.opening < 0 ||
        !Array.isArray(journal.seen) || journal.seen.some(id => typeof id !== 'string') ||
        !Array.isArray(journal.awards) || journal.awards.some(award => !isRecord(award) ||
          typeof award.id !== 'string' || !Number.isFinite(award.amount) || award.amount < 0)) {
      throw new Error('Saved bonus earnings cannot be read safely. The original data has not been replaced.')
    }
  }
  for (const habit of saved.habits) {
    if (!isRecord(habit) || typeof habit.id !== 'string' || !habit.id || typeof habit.name !== 'string') {
      throw new Error('A saved habit cannot be read safely.')
    }
    for (const key of ['history', 'dailyValueHistory', 'freezeDates', 'streakMilestones']) {
      if (habit[key] != null && !isRecord(habit[key])) throw new Error(`Cannot read saved habit ${key}.`)
    }
    if (habit.customDays != null && !Array.isArray(habit.customDays)) throw new Error('Cannot read saved habit schedule.')
  }
  if (saved.rewards.some(reward => !isRecord(reward)) ||
      saved.claimedRewards?.some(claim => !isRecord(claim)) ||
      saved.earnedBadges?.some(badge => !isRecord(badge))) {
    throw new Error('A saved reward or badge cannot be read safely.')
  }
}

export const loadStoredState = async (storage, migrate) => {
  for (const key of STORAGE_KEYS) {
    const saved = await storage.getItem(key)
    if (key === STORAGE_KEY) {
      const protectedCopy = await storage.getItem(PROTECTED_KEY)
      if (protectedCopy != null && JSON.stringify(saved ?? null) !== JSON.stringify(protectedCopy)) {
        throw new StorageConflictError(saved ?? null, protectedCopy)
      }
    }
    // A malformed/falsy value is NOT an empty database.
    if (saved === null || saved === undefined) continue
    validateStoredState(saved)
    const migrated = migrate(saved)
    validateStoredState(migrated)
    if ((saved.schemaVersion ?? 1) < SCHEMA_VERSION || key !== STORAGE_KEY || migrated !== saved) {
      const recoveryKey = `namami-recovery:${key}:${crypto.randomUUID()}`
      await storage.setItem(recoveryKey, saved)
      const recovery = await storage.getItem(recoveryKey)
      if (JSON.stringify(recovery) !== JSON.stringify(saved)) throw new Error('Could not verify a recovery copy. The original data has not been replaced.')
    }
    // Older versions may omit optional collections. Retain all other fields.
    return { customQuotes: [], claimedRewards: [], earnedBadges: [], ...migrated }
  }
  return null
}
