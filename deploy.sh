#!/usr/bin/env bash
#
# Production deploy for nq-packman. Run ON the server, from the app root
# (the directory that holds artisan and public_html/):
#
#   ./deploy.sh
#
# Steps: git pull -> composer install (only when composer.lock moved)
#        -> front-end assets -> migrate -> rebuild caches -> verify.
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
# Assets: the game is bundled by Vite into public_html/build/, which is
# gitignored. If node is on the server the build runs here; otherwise build
# locally and upload with cx.sh option 27 BEFORE deploying.

set -euo pipefail
cd "$(dirname "$0")"

echo "→ git pull"
LOCK_BEFORE=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
PKG_BEFORE=$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
git pull --ff-only
LOCK_AFTER=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
PKG_AFTER=$(git rev-parse HEAD:package-lock.json 2>/dev/null || echo none)

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

echo "→ front-end assets"
if command -v npm >/dev/null 2>&1; then
    if [ "$PKG_BEFORE" != "$PKG_AFTER" ] || [ ! -d node_modules ]; then
        npm ci --no-audit --no-fund
    fi
    npm run build
elif [ -f public_html/build/manifest.json ]; then
    echo "  npm not on PATH — using the uploaded public_html/build/ (cx.sh 27)"
else
    echo "✗ No npm here and no public_html/build/manifest.json."
    echo "  Run ./cx.sh 27 locally to build and upload the assets, then redeploy."
    exit 1
fi

echo "→ storage permissions"
mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache
[ -L public_html/storage ] || php artisan storage:link >/dev/null 2>&1 || true

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
for f in public_html/index.php public_html/build/manifest.json; do
    [ -f "$f" ] || { echo "✗ missing $f"; exit 1; }
done
echo "  assets      : present"
php artisan route:list --path=/ --columns=method,uri,name

echo "✓ deployed $(git log --oneline -1)"
