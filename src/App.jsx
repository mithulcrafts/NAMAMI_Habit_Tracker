import './App.css'
import { useEffect, useReducer, useRef } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Home } from './pages/Home'
import { RewardsPage } from './pages/RewardsPage'
import { Settings } from './pages/Settings'

const initialShellState = {
  currentPage: 'home',
  hydrated: false,
  installAvailable: false,
  installing: false,
}

const shellReducer = (state, action) => {
  switch (action.type) {
    case 'setPage':
      return { ...state, currentPage: action.payload }
    case 'setHydrated':
      return { ...state, hydrated: true }
    case 'setInstallAvailable':
      return { ...state, installAvailable: action.payload }
    case 'setInstalling':
      return { ...state, installing: action.payload }
    default:
      return state
  }
}

const Shell = () => {
  const {
    loading,
    storageError,
    retryStorage,
    downloadRecovery,
    habits,
    points,
    lifetimePoints,
    pointsSpent,
    bonusDays,
    globalStreak,
    rewards,
    claimedRewards,
    earnedBadges,
    badgeDefinitions,
    quoteOfDay,
    settings,
    streakFreezes,
    streakFreezeCost,
    addHabit,
    toggleCompletion,
    updateHabit,
    deleteHabit,
    addReward,
    claimReward,
    updateReward,
    deleteReward,
    buyStreakFreeze,
    useStreakFreeze,
    removeStreakFreeze,
    updateSettings,
    addCustomQuote,
    updateHabitGamification,
    adjustMithura,
  } = useApp()

  const [shellState, dispatch] = useReducer(shellReducer, initialShellState)
  const { currentPage, hydrated, installAvailable, installing } = shellState

  const shortcutHandled = useRef(false)
  useEffect(() => {
    if (loading || !hydrated || shortcutHandled.current) return
    const mode = new URLSearchParams(window.location.search).get('mode')
    if (mode !== 'add' && mode !== 'checkins') return
    const target = document.getElementById(mode === 'add' ? 'habit-name' : 'checkins')
    if (!target) return
    shortcutHandled.current = true
    target.scrollIntoView?.({ block: 'center' })
    if (mode === 'add') target.focus()
  }, [loading, hydrated])

  // Remove splash screen when data is loaded
  useEffect(() => {
    if ((!loading || storageError) && !hydrated) {
      dispatch({ type: 'setHydrated' })
      window._NAMAMI_HYDRATED?.()
    }
  }, [loading, storageError, hydrated])

  useEffect(() => {
    const onReady = () => dispatch({ type: 'setInstallAvailable', payload: true })
    const onInstalled = () => dispatch({ type: 'setInstallAvailable', payload: false })

    window.addEventListener('installPromptReady', onReady)
    window.addEventListener('appinstalled', onInstalled)

    if (window.__NAMAMI_INSTALL_READY) {
      dispatch({ type: 'setInstallAvailable', payload: true })
    }

    return () => {
      window.removeEventListener('installPromptReady', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installAvailable || typeof window.triggerInstall !== 'function') return
    dispatch({ type: 'setInstalling', payload: true })
    try {
      await window.triggerInstall()
    } finally {
      dispatch({ type: 'setInstallAvailable', payload: Boolean(window.__NAMAMI_INSTALL_READY) })
      dispatch({ type: 'setInstalling', payload: false })
    }
  }

  if (['load', 'locked', 'conflict'].includes(storageError?.kind)) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div role="alert" className="mx-auto max-w-xl space-y-3">
          <h1 className="text-xl font-semibold">{storageError.kind === 'load' ? 'Your habits could not be loaded' : 'This copy is not editable'}</h1>
          <p>Saving is paused to protect your existing data. Do not clear the app's site data.</p>
          <p>{storageError.message}</p>
          <button type="button" className="rounded-md border px-4 py-2" onClick={retryStorage}>Retry</button>
          {(!loading || storageError.recovery) && <button type="button" className="ml-2 rounded-md border px-4 py-2" onClick={downloadRecovery}>{loading ? 'Download recovery copies' : "Download this tab's changes"}</button>}
        </div>
      </div>
    )
  }

  if (!hydrated || loading) {
    return null
  }

  const pageContent =
    currentPage === 'home' ? (
      <Home
        habits={habits}
        points={points}
        lifetimePoints={lifetimePoints}
        pointsSpent={pointsSpent}
        bonusDays={bonusDays}
        globalStreak={globalStreak}
        earnedBadges={earnedBadges}
        quoteOfDay={quoteOfDay}
        category={settings.quoteCategory}
        onCategoryChange={(category) => updateSettings({ quoteCategory: category })}
        onAddCustomQuote={addCustomQuote}
        onAddHabit={addHabit}
        onToggle={toggleCompletion}
        onEditHabit={updateHabit}
        onDeleteHabit={deleteHabit}
        onUpdateHabitGamification={updateHabitGamification}
        streakFreezes={streakFreezes}
        onUseStreakFreeze={useStreakFreeze}
        onRemoveStreakFreeze={removeStreakFreeze}
      />
    ) : currentPage === 'rewards' ? (
      <RewardsPage
        rewards={rewards}
        claimedRewards={claimedRewards}
        points={points}
        earnedBadges={earnedBadges}
        badgeDefinitions={badgeDefinitions}
        habits={habits}
        streakFreezes={streakFreezes}
        streakFreezeCost={streakFreezeCost}
        onBuyStreakFreeze={buyStreakFreeze}
        onAddReward={addReward}
        onClaimReward={claimReward}
        onUpdateReward={updateReward}
        onDeleteReward={deleteReward}
      />
    ) : currentPage === 'settings' ? (
      <Settings settings={settings} onUpdate={updateSettings} onAdjustMithura={adjustMithura} />
    ) : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 overflow-x-hidden px-4 pb-10 pt-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icons/namami-icon.svg"
              alt="NAMAMI logo"
              className="h-12 w-12 rounded-lg"
            />
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>NAMAMI</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Your habit Tracker</p>
            </div>
          </div>
          
          {/* Simple Tab Navigation */}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {installAvailable && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: 'var(--active-bg)',
                  color: 'var(--text-primary)',
                  opacity: installing ? 0.6 : 1,
                }}
              >
                {installing ? 'Installing...' : 'Install'}
              </button>
            )}
            <div className="flex w-full gap-1 rounded-lg p-1 sm:w-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <button
              onClick={() => dispatch({ type: 'setPage', payload: 'home' })}
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4"
              style={{
                backgroundColor: currentPage === 'home' ? 'var(--active-bg)' : 'transparent',
                color: currentPage === 'home' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              Home
            </button>
            <button
              onClick={() => dispatch({ type: 'setPage', payload: 'rewards' })}
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4"
              style={{
                backgroundColor: currentPage === 'rewards' ? 'var(--active-bg)' : 'transparent',
                color: currentPage === 'rewards' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              Rewards
            </button>
            <button
              onClick={() => dispatch({ type: 'setPage', payload: 'settings' })}
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4"
              style={{
                backgroundColor: currentPage === 'settings' ? 'var(--active-bg)' : 'transparent',
                color: currentPage === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              Settings
            </button>
            </div>
          </div>
        </div>

        {storageError?.kind === 'save' && (
          <div role="alert" className="rounded-md border p-3" style={{ color: 'var(--text-primary)' }}>
            <p>Your latest changes could not be saved. Keep this app open and retry.</p>
            <p>{storageError.message}</p>
            <button type="button" className="mt-2 rounded-md border px-4 py-2" onClick={retryStorage}>Retry</button>
          </div>
        )}

        {/* Page Content */}
        {pageContent}
      </div>
    </div>
  )
}

const App = () => (
  <AppProvider>
    <Shell />
  </AppProvider>
)

export default App
