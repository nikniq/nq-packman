# Night Market Run

A maze chase arcade game built on Laravel. A street cat races through a hawker night market eating every satay stick while four rival cats (Scar, Misty, Bolt and Dozy) give chase; a durian turns the tables for a few seconds. The characters, mazes, snacks and sounds are original.

The web root is `public_html/` (not the default `public/`). Point your web server's document root there.

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install && npm run build
php artisan serve
```

## Playing

Arrow keys or WASD to move, or swipe on a touch screen. Enter or tap starts, P pauses, M toggles sound. The high score is kept in the browser.

- **A new market every level.** Mazes are generated from a seed (`resources/js/game/maze.js`): mirrored, every lane part of a loop, den and tunnel always in the same place. Level *n* is the same maze for everyone.
- **Daily run.** Press D or the DAILY button for the day's course, seeded by the date (Singapore time). One attempt per player per day; today's top 10 sits beside the world board.
- **Power-ups.** One per level, a third of the way in: FREEZE (rivals stop), MAGNET (nearby snacks fly in), DECOY (rivals chase a copy), PHASE (slip through one stall).
- **Player two.** Tab hands a rival to a second player, who steers it with IJKL; Tab again cycles to the next cat, and back to the AI after the last.

## Accounts and leaderboard

Players can sign in with Google to save finished games to the world top 10 and today's daily board. The game is fully playable without signing in. Sign-in is only offered when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`: create an OAuth client in the Google Cloud console with the authorised redirect URI `{APP_URL}/auth/google/callback`. There are no passwords; a Google account is linked to an existing email account only when Google reports the address as verified.

## Tests

```bash
php artisan test   # page and route
npm test           # game engine (node --test, no browser needed)
```

## Operations

- `cx.sh` runs on the server from the app root (or from a workstation, where it drives the server over SSH) (deploy, caches, logs, health, maintenance mode). The server settings are at the top of the script and can be overridden with environment variables (`REMOTE_HOST=… ./cx.sh 30`). Run `./cx.sh` for the menu; `./cx.sh 36` diagnoses a 403/500 on the live site.
- `deploy.sh` runs on the server (`./deploy.sh --check` verifies without changing anything): `git pull`, composer (when the lockfile changed), migrate, cache rebuild, verify. It never runs npm.
- The Vite output in `public_html/build/` is committed, because shared hosting cannot run the bundler. `./cx.sh 20` rebuilds it before deploying; commit the result with the rest of your change.
