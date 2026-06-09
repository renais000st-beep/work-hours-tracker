# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
# Next.js app
npm run dev        # dev server on localhost:3000
npm run build      # production build
npm run lint       # ESLint

# Telegram bot (in telegram-bot/)
npm run dev        # run bot with tsx (hot reload)
npm run build      # compile TypeScript
npm start          # run compiled bot
```

## Environment Variables

The Next.js app requires `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The Telegram bot requires `telegram-bot/.env`:
```
TELEGRAM_BOT_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Architecture

**Work Hours Tracker** — a Next.js 16 / React 19 app for tracking employee work shifts, backed by Supabase (Postgres + Auth).

### User Flow

`/` → redirect to `/login` → on success → `/dashboard` (or `/first-login` if profile not completed)

- `/login` — email/password via Supabase Auth
- `/first-login` — new users enter first/last name (sets `profile_completed = true`)
- `/setup-username` — additional profile setup
- `/dashboard` — main view: calendar + stats; users log actual worked shifts
- `/schedule` — planned schedule: editors create planned shifts, viewers can view
- `/admin` — admin-only panel: manage users, groups, export XLSX

### Supabase Data Model (key tables)

- `profiles` — extends auth.users; fields: `first_name`, `last_name`, `role` (`admin`/`editor`/`viewer`), `profile_completed`, `telegram_id`, `telegram_linked`
- `shifts` — actual worked shifts; fields: `user_id`, `date`, `start_time`, `end_time`, `group_id`
- `planned_shifts` — planned schedule entries; fields: `user_id`, `date`, `start_time`, `end_time`, `group_id`
- `groups` — work groups (e.g. `ingo`, `stefan`)
- `user_groups` — many-to-many: users ↔ groups, with per-group `role` (`editor`/`viewer`)
- `schedule_notes` — notes per group per date on the schedule page

### Auth & Role Guards

All pages call `supabase.auth.getUser()` in `useEffect` and redirect to `/login` if no session. Admin pages additionally check `profile.role === 'admin'`. Schedule edit actions check the user's role in `user_groups` for the active group.

### i18n

`lib/i18n.tsx` provides `I18nProvider` and `useTranslation()` hook. Two languages: `ru` (Russian) and `de` (German). Translations live in `lib/translations/ru.json` and `lib/translations/de.json`. Language preference is persisted in `localStorage`. Always add new UI strings to both translation files.

### Telegram Bot (`telegram-bot/`)

Built with [grammY](https://grammy.dev/). Connects to the same Supabase project using the service role key. Allows users to log shifts via Telegram by linking their `telegram_id` to a profile. Bot state machine is kept in-memory (`Map<userId, ShiftState>`). Entry point: `src/bot.ts`.

### Key Libraries

- `@supabase/supabase-js` — database + auth client (no `@supabase/auth-helpers-nextjs` patterns — uses `createClient` directly from `lib/supabase.ts`)
- `date-fns` — all date manipulation; German locale (`de`) used for display
- `xlsx` — export to Excel in dashboard and admin panel
- `lucide-react` — icons
- Tailwind CSS v4 (PostCSS plugin, no `tailwind.config.js`)

## Working Style

Before implementing anything non-trivial, present a short plan and wait for approval. Then implement.

## Common Tasks

- **New UI feature**: add component → wire up Supabase query → add translations to both `ru.json` and `de.json`
- **Bug fix**: identify root cause first, present fix plan, then apply
- **i18n**: always update both `lib/translations/ru.json` AND `lib/translations/de.json` — never one without the other
- **Supabase schema change**: check existing RLS policies before writing new queries; prefer using existing `createClient` from `lib/supabase.ts`

## i18n Checklist

When adding any user-visible string:
1. Add key to `lib/translations/ru.json`
2. Add key to `lib/translations/de.json`
3. Use `t('key')` via `useTranslation()` hook — never hardcode strings
