#!/usr/bin/env bash
#
# Production deploy for nq-packman. Run ON the server, from the app root
# (the directory that holds artisan and public_html/):
#
#   ./deploy.sh
#
# Steps: git pull -> composer install (only when composer.lock moved)
#        -> migrate -> rebuild caches -> verify.
#
# The server deploys by pulling from git, so only pushed commits reach it.
# The whole sequence lives here so the steps cannot drift apart: a pull
# without a migrate or a cache rebuild is how a Laravel site 500s after a
# "successful" deploy.
#
# The web root is public_html/ (bootstrap/app.php registers it with
# usePublicPath), so point the vhost or hosting panel there, never at the
# app root.
#
# Assets: the Vite bundle in public_html/build/ is COMMITTED, so this script
# never runs npm. Shared hosting cannot run the bundler (Rolldown needs a
# worker thread pool and the account's process limit refuses it), so build
# locally and commit: cx.sh option 20 does that before each deploy.

set -euo pipefail
cd "$(dirname "$0")"

# Everything runs inside a function so bash parses the whole file before
# executing any of it. Without this, the git pull below can replace this
# very script while it is running and bash carries on reading stale bytes.
main() {
    echo "→ git pull"
    LOCK_BEFORE=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
    git pull --ff-only
    LOCK_AFTER=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)

    if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ] || [ ! -d vendor ]; then
        if command -v composer >/dev/null 2>&1; then
            echo "→ composer install (lockfile changed or vendor/ missing)"
            composer install --no-dev --optimize-autoloader --no-interaction
        else
            # Not fatal: the pull has already landed, and stopping here would
            # leave the tree un-migrated as well. Say so loudly instead.
            echo "⚠ composer.lock changed but composer is not on PATH."
            echo "  Install dependencies manually before trusting this deploy."
        fi
    fi

    if [ ! -f .env ]; then
        echo "✗ No .env on the server. Copy .env.example to .env, set APP_URL,"
        echo "  APP_ENV=production, APP_DEBUG=false and run: php artisan key:generate"
        exit 1
    fi

    # Drop any cached config first so edits to .env are honoured by the
    # steps below; optimize rebuilds the cache at the end.
    echo "→ clear config cache"
    php artisan config:clear --quiet

    echo "→ storage permissions"
    mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache
    chmod -R ug+rwX storage bootstrap/cache
    [ -L public_html/storage ] || php artisan storage:link >/dev/null 2>&1 || true

    # The default .env uses SQLite; the file must exist before migrate runs.
    if grep -qE '^DB_CONNECTION=sqlite' .env && ! grep -qE '^DB_DATABASE=' .env; then
        [ -f database/database.sqlite ] || { echo "→ creating database/database.sqlite"; touch database/database.sqlite; }
    fi

    echo "→ migrate"
    php artisan migrate --force

    echo "→ cache config/routes/views"
    php artisan optimize

    echo "→ verify"
    PUBLIC_PATH=$(php artisan tinker --execute='echo public_path();' 2>/dev/null | tr -d '\r' || true)
    case "$PUBLIC_PATH" in
        */public_html) echo "  public path : $PUBLIC_PATH" ;;
        "")            echo "  public path : (tinker unavailable on this PHP; skipped)" ;;
        *)             echo "✗ public path is $PUBLIC_PATH, expected …/public_html"; exit 1 ;;
    esac
    if grep -qE '^APP_DEBUG=true' .env; then
        echo "⚠ APP_DEBUG=true in .env — stack traces will be shown to visitors."
    fi
    for f in public_html/index.php public_html/build/manifest.json public_html/icon.svg public_html/manifest.webmanifest; do
        [ -f "$f" ] || { echo "✗ missing $f (the Vite build is committed; run ./cx.sh 20 locally)"; exit 1; }
    done
    echo "  assets      : present"
    php artisan route:list --except-vendor

    echo "✓ deployed $(git log --oneline -1)"
}

main "$@"
