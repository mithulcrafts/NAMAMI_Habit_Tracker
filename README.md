# NAMAMI Habit Tracker

NAMAMI Habit Tracker is an offline-first habit tracker.
It is designed for private, on-device tracking with no account, no backend, and no cloud dependency.

## Development Notice
This project was created as a hobby and shared publicly in the hope that it may be useful to others.

It was developed using AI-assisted ("vibe coding") techniques, and large portions of the code were not manually reviewed. As a result, the codebase may contain bugs, edge-case failures, performance issues, or security problems.

This repository is provided for learning, experimentation, and personal use. Do not rely on it for production, backups, financial tracking, health data, or anything important.

Use at your own risk.

## Quick Start

```bash
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Why NAMAMI Habit Tracker

- Local-first privacy: your data stays in your browser storage
- Fast daily flow: check in habits from one dashboard
- Flexible goals: binary, count, and duration habits
- Optional motivation: points, quotes, badges, rewards, and streak freeze

## Scripts

- `npm run dev` — start development server
- `npm run build` — create production build in `dist/`
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

## What It Includes

- Habit tracking with `binary`, `count`, and `duration` goals
- Daily and target-based habits
- Streaks, MITHURA points, badges, rewards, and streak freeze
- Global + per-habit heatmaps and progress charts
- Daily quotes (general or Gita) + custom quotes
- Light/dark theme and installable PWA
- Local IndexedDB storage via `localforage`

## App Sections

- **Home**: daily check-ins, date navigation, heatmaps, charts, and quote card
- **Rewards**: earned badges, redeemable rewards, and streak freeze controls
- **Settings**: theme, quote category, and default gamification behavior

## Documentation

- [docs/OVERVIEW.md](docs/OVERVIEW.md)
- [docs/FEATURES.md](docs/FEATURES.md)
- [docs/TECHNICAL.md](docs/TECHNICAL.md)
- [docs/UI_DESIGN.md](docs/UI_DESIGN.md)
- [docs/INSTALLATION.md](docs/INSTALLATION.md)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

Suggested reading order for new contributors:
1. [docs/OVERVIEW.md](docs/OVERVIEW.md)
2. [docs/FEATURES.md](docs/FEATURES.md)
3. [docs/TECHNICAL.md](docs/TECHNICAL.md)
4. [docs/INSTALLATION.md](docs/INSTALLATION.md)


## Repo Structure
```
└── 📁NAMAMI-Habit-tracker
    └── 📁.agents
        └── 📁react-doctor
            ├── AGENTS.md
            ├── SKILL.md
    └── 📁.github
        └── 📁ISSUE_TEMPLATE
            ├── bug.yml
            ├── docs.yml
            ├── feature.yml
        ├── copilot-instructions.md
        ├── PULL_REQUEST_TEMPLATE.md
    └── 📁docs
        ├── CONTRIBUTING.md
        ├── FEATURES.md
        ├── INSTALLATION.md
        ├── OVERVIEW.md
        ├── TECHNICAL.md
        ├── UI_DESIGN.md
    └── 📁public
        └── 📁icons
            ├── namami-icon.svg
            ├── namami-splash-logo.jpeg
        ├── manifest.webmanifest
        ├── service-worker.js
        ├── vite.svg
    └── 📁src
        └── 📁assets
            ├── react.svg
        └── 📁components
            ├── Badges.jsx
            ├── DashboardStats.jsx
            ├── DateNavigator.jsx
            ├── EarnedBadges.jsx
            ├── GlobalHeatmap.jsx
            ├── HabitCard.jsx
            ├── HabitForm.jsx
            ├── HabitGamificationPanel.jsx
            ├── Heatmap.jsx
            ├── ProgressCharts.jsx
            ├── QuoteCard.jsx
            ├── Rewards.jsx
        └── 📁context
            ├── AppContext.jsx
        └── 📁data
            ├── quotes.js
        └── 📁hooks
        └── 📁pages
            ├── Dashboard.jsx
            ├── HabitDetail.jsx
            ├── Home.jsx
            ├── QuotesPage.jsx
            ├── RewardsPage.jsx
            ├── Settings.jsx
        └── 📁utils
            ├── date.js
            ├── notifications.js
        ├── App.css
        ├── App.jsx
        ├── index.css
        ├── main.jsx
    ├── .gitignore
    ├── eslint.config.js
    ├── index.html
    ├── LICENSE
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.js
    ├── README.md
    ├── tailwind.config.js
    ├── vercel.json
    └── vite.config.js
```

## License

MIT





