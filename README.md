# Packman

A Pac-Man game built on Laravel.

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

## Accounts and leaderboard

Players can sign in with Google to save finished games to a world top 10. The game is fully playable without signing in. Sign-in is only offered when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`: create an OAuth client in the Google Cloud console with the authorised redirect URI `{APP_URL}/auth/google/callback`. There are no passwords; a Google account is linked to an existing email account only when Google reports the address as verified.

## Tests

```bash
php artisan test   # page and route
npm test           # game engine (node --test, no browser needed)
```

## Operations

- `cx.sh` runs locally and drives the server over SSH (deploy, caches, logs, health, maintenance mode). The server settings are at the top of the script and can be overridden with environment variables (`REMOTE_HOST=… ./cx.sh 30`). Run `./cx.sh` for the menu; `./cx.sh 36` diagnoses a 403/500 on the live site.
- `deploy.sh` runs on the server (`./deploy.sh --check` verifies without changing anything): `git pull`, composer (when the lockfile changed), migrate, cache rebuild, verify. It never runs npm.
- The Vite output in `public_html/build/` is committed, because shared hosting cannot run the bundler. `./cx.sh 20` rebuilds it before deploying; commit the result with the rest of your change.
