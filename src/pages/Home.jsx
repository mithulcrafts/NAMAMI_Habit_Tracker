import { useCallback, useMemo, useState } from 'react'
import { HabitCard } from '../components/HabitCard'
import { HabitForm } from '../components/HabitForm'
import { DashboardStats } from '../components/DashboardStats'
import { QuoteCard } from '../components/QuoteCard'
import { GlobalHeatmap } from '../components/GlobalHeatmap'
import { Heatmap } from '../components/Heatmap'
import { DateNavigator } from '../components/DateNavigator'
import { HabitDetail } from './HabitDetail'
import { todayKey, formatDate } from '../utils/date'
import { useToday } from '../hooks/useToday'

export const Home = ({
  habits,
  points,
  lifetimePoints,
  pointsSpent,
  bonusDays,
  globalStreak,
  earnedBadges,
  quoteOfDay,
  category,
  onCategoryChange,
  onAddCustomQuote,
  onAddHabit,
  onToggle,
  onEditHabit,
  onDeleteHabit,
  onUpdateHabitGamification,
  streakFreezes,
  onUseStreakFreeze,
  onRemoveStreakFreeze,
}) => {
  const [editing, setEditing] = useState(null)
  const [openDetailHabitId, setOpenDetailHabitId] = useState(null)
  // null follows Today across midnight; explicit historical selections stay put.
  const [chosenDate, setSelectedDate] = useState(null)
  const today = useToday()
  const selectedDate = chosenDate ?? new Date(`${today}T00:00:00`)
  const selectedDateKey = formatDate(selectedDate)
  const isToday = selectedDateKey === today
  const selectedDateDisplay = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const relativeLabel = (() => {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const selectedDay = new Date(selectedDate)
    selectedDay.setHours(0, 0, 0, 0)
    const diffDays = Math.round((todayDate - selectedDay) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays > 1) return `${diffDays} days ago`
    return 'Upcoming'
  })()

  const openDetailHabit = openDetailHabitId ? habits.find((h) => h.id === openDetailHabitId) : null

  const handlePreviousDay = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = prev ? new Date(prev) : new Date()
      newDate.setDate(newDate.getDate() - 1)
      return newDate
    })
  }, [])

  const handleNextDay = useCallback(() => {
    setSelectedDate(prev => {
      const newDate = prev ? new Date(prev) : new Date()
      newDate.setDate(newDate.getDate() + 1)
      return formatDate(newDate) === todayKey() ? null : newDate
    })
  }, [])

  const handleDateChange = useCallback((value) => {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    if (Number.isNaN(parsed.getTime())) return
    setSelectedDate(value === todayKey() ? null : parsed)
  }, [])

  const sortedHabits = useMemo(
    () =>
      [...habits].sort((a, b) => {
        const doneA = a.history?.[today] ? 1 : 0
        const doneB = b.history?.[today] ? 1 : 0
        return doneA === doneB ? b.streak - a.streak : doneA - doneB
      }),
    [habits, today],
  )

  return (
    <div className="space-y-6">
      <QuoteCard
        quote={quoteOfDay}
        category={category}
        onCategoryChange={onCategoryChange}
        onAddCustom={onAddCustomQuote}
      />

      <DateNavigator
        selectedDateDisplay={selectedDateDisplay}
        selectedDateKey={selectedDateKey}
        today={today}
        isToday={isToday}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onDateChange={handleDateChange}
      />

      <DashboardStats
        habits={habits}
        points={points}
        lifetimePoints={lifetimePoints}
        pointsSpent={pointsSpent}
        bonusDays={bonusDays}
        globalStreak={globalStreak}
      />

      <GlobalHeatmap habits={habits} />

      {habits.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {habits.map((habit) => (
            <Heatmap
              key={`heatmap-${habit.id}`}
              history={habit.history}
              habitColor={habit.habitColor}
              habitName={habit.name}
              goalType={habit.goalType}
              goalTarget={habit.goalTarget}
              dailyValueHistory={habit.dailyValueHistory}
              freezeDates={habit.freezeDates}
            />
          ))}
        </div>
      )}

      <div id="checkins" className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {sortedHabits.map((habit) => (
            <div key={habit.id}>
              <HabitCard
                habit={habit}
                selectedDateKey={selectedDateKey}
                isToday={isToday}
                selectedDateLabel={selectedDateDisplay}
                relativeLabel={relativeLabel}
                onToggle={onToggle}
                onOpen={() => setOpenDetailHabitId(habit.id)}
                onEdit={(h) => setEditing(h)}
                onDelete={onDeleteHabit}
                streakFreezes={streakFreezes}
                onUseStreakFreeze={onUseStreakFreeze}
                onRemoveStreakFreeze={onRemoveStreakFreeze}
              />
              {openDetailHabitId === habit.id && openDetailHabit && (
                <div className="mt-3">
                  <HabitDetail
                    habit={openDetailHabit}
                    points={lifetimePoints}
                    earnedBadges={earnedBadges}
                    onUpdateHabitGamification={onUpdateHabitGamification}
                    onClose={() => setOpenDetailHabitId(null)}
                  />
                </div>
              )}
            </div>
          ))}
          {!sortedHabits.length && (
            <div className="rounded-xl border border-white/5 bg-slate-900/70 p-4 text-sm text-slate-300">
              No habits yet. Add your first one to begin earning MITHURA.
            </div>
          )}
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white">Add habit</h3>
          <HabitForm
            key={editing?.id ?? 'new-habit-form'}
            initial={editing}
            onSave={(data) => {
              if (editing) {
                onEditHabit(editing.id, data)
              } else {
                onAddHabit(data)
              }
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    </div>
  )
}
