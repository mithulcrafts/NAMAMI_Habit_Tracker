# Contributing

Contributions are welcome. Keep changes focused, testable, and easy to review.

## Workflow

1. Create a branch from `main`
2. Make focused changes
3. Run checks
4. Open a PR with clear summary and test notes

## First-Time Contributor Setup

1. Install dependencies with `npm install`
2. Start the app with `npm run dev`
3. Confirm the app opens at `http://localhost:5173`
4. Create a branch before making edits

## Before You Start

- Read `docs/OVERVIEW.md` and `docs/TECHNICAL.md` for project context
- Prefer small PRs over large mixed refactors
- Keep scope aligned with the issue or feature request
- Check for existing issues/PRs to avoid duplicated work

## Local Checks

```bash
npm test
npm run lint
npm run build
npm run preview
```

For UI changes, include brief manual validation notes (what page you tested and expected result).

Recommended order before opening a PR:

1. `npm test`, then `npm run lint`
2. `npm run build`
3. `npm run preview` (quick sanity pass)

## Coding Notes

- Keep changes small and targeted
- Match existing React + Tailwind patterns
- Use `AppContext` flows instead of introducing duplicate global state
- Avoid unrelated refactors in the same PR

## PR Guidelines

- Use conventional style titles: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`
- Include: what changed, why, and how you tested
- Add screenshots for visible UI changes

### PR Checklist

- Scope is limited to one feature/fix/docs concern
- No unrelated refactors are bundled
- Relevant docs are updated if behavior changed
- Manual test notes are included

## Documentation Changes

- Update relevant docs when behavior or UX changes
- Keep wording clear and concise
- Avoid adding speculative or roadmap-only content

## Issues

When reporting bugs, include reproduction steps, expected/actual behavior, and environment details.
