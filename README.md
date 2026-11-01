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

## Operations

- `cx.sh` runs locally and drives the server over SSH (deploy, caches, logs, health, maintenance mode). Copy `vars.sh.example` to `vars.sh` and fill in the host details first. Run `./cx.sh` for the menu.
- `deploy.sh` runs on the server: `git pull`, composer (when the lockfile changed), Vite build, migrate, cache rebuild, verify.
- The Vite output in `public_html/build/` is not committed. If the server has no Node, run `./cx.sh 27` to build locally and upload it before deploying.
