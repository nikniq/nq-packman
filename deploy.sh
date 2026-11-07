#!/usr/bin/env bash
#
# Production deploy for nq-packman. Run ON the server, from the app root
# (the directory that holds artisan and public_html/):
#
#   ./deploy.sh            # pull + install + migrate + caches + verify
#   ./deploy.sh --check    # verify only: no pull, no migrate (diagnose a
#                          # 403/500 without changing anything)
#
# The server deploys by pulling from git, so only pushed commits reach it.
# The whole sequence lives here so the steps cannot drift apart: a pull
# without a migrate or a cache rebuild is how a Laravel site 500s after a
# "successful" deploy.
#
# Layout on SiteGround (and any host that serves ~/www/<domain>/public_html):
#
#   ~/www/packman.nikniq.com/            <- this repo (app root, not served)
#   ~/www/packman.nikniq.com/public_html <- document root (index.php, build/)
#
# bootstrap/app.php registers public_html/ with usePublicPath, so the hosting
# panel's document root for the domain must be that directory. A 403 on the
# home page almost always means the document root points somewhere else, or
# the directory permissions are too open for the host's PHP handler.
#
# Assets: the Vite bundle in public_html/build/ is COMMITTED, so this script
# never runs npm. Shared hosting cannot run the bundler (Rolldown needs a
# worker thread pool and the account's process limit refuses it), so build
# locally and commit: cx.sh option 20 does that before each deploy.

set -euo pipefail
cd "$(dirname "$0")"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

# Everything runs inside functions so bash parses the whole file before
# executing any of it. Without this, the git pull below can replace this
# very script while it is running and bash carries on reading stale bytes.

env_value() {
    # Value of KEY in .env, without quotes; empty when unset.
    sed -nE "s/^$1=[\"']?([^\"'#]*)[\"']?.*/\1/p" .env 2>/dev/null | tail -n 1 | tr -d '\r'
}

pull() {
    # Tracked files deleted on the server (a panel "clean up", a stray rm)
    # stay deleted across pulls: git only merges, it does not restore. The
    # symptom is a 403 on the home page because public_html/index.php and
    # .htaccess are gone. Put them back before pulling.
    DELETED=$(git ls-files -d)
    if [ -n "$DELETED" ]; then
        echo "→ restoring tracked files deleted on the server:"
        echo "$DELETED" | sed 's/^/    /'
        echo "$DELETED" | tr '\n' '\0' | xargs -0 git checkout --
    fi

    echo "→ git pull"
    LOCK_BEFORE=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)
    git pull --ff-only
    LOCK_AFTER=$(git rev-parse HEAD:composer.lock 2>/dev/null || echo none)

    if [ "$LOCK_BEFORE" != "$LOCK_AFTER" ] || [ ! -d vendor ] || [ ! -f vendor/autoload.php ]; then
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
}

check_env() {
    if [ ! -f .env ]; then
        echo "✗ No .env on the server. Run:"
        echo "    cp .env.example .env && php artisan key:generate"
        echo "  then set APP_URL, APP_ENV=production, APP_DEBUG=false in .env"
        exit 1
    fi
    if [ -z "$(env_value APP_KEY)" ]; then
        echo "→ APP_KEY missing: generating"
        php artisan key:generate --force --quiet
    fi
}

prepare() {
    # Drop any cached config first so edits to .env are honoured by the
    # steps below; optimize rebuilds the cache at the end.
    echo "→ clear config cache"
    php artisan config:clear --quiet

    echo "→ permissions"
    mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache
    chmod -R ug+rwX storage bootstrap/cache
    # Shared hosts run PHP as the account user and refuse (403/500) to serve
    # world- or group-writable web files. Keep the served tree conservative.
    chmod 755 . public_html
    find public_html -type d -exec chmod 755 {} +
    find public_html -type f -exec chmod 644 {} +
    [ -L public_html/storage ] || php artisan storage:link >/dev/null 2>&1 || true

    # The default .env uses SQLite; the file must exist before migrate runs.
    if [ "$(env_value DB_CONNECTION)" = "sqlite" ]; then
        DB_FILE=$(env_value DB_DATABASE)
        DB_FILE="${DB_FILE:-database/database.sqlite}"
        [ -f "$DB_FILE" ] || { echo "→ creating $DB_FILE"; touch "$DB_FILE"; }
    fi
}

migrate_and_cache() {
    echo "→ migrate"
    php artisan migrate --force

    echo "→ cache config/routes/views"
    php artisan optimize
}

verify() {
    echo "→ verify"
    local ok=1

    # --- settings -----------------------------------------------------------
    APP_URL=$(env_value APP_URL)
    APP_ENV=$(env_value APP_ENV)
    APP_DEBUG=$(env_value APP_DEBUG)
    echo "  APP_URL     : ${APP_URL:-(unset)}"
    case "$APP_URL" in
        https://*) ;;
        "")               echo "  ⚠ APP_URL is unset — set it to the public https URL"; ;;
        *localhost*|http:*) echo "  ⚠ APP_URL should be the public https URL, not $APP_URL" ;;
    esac
    [ "$APP_ENV" = "production" ] || echo "  ⚠ APP_ENV=$APP_ENV — set APP_ENV=production"
    [ "$APP_DEBUG" = "true" ] && echo "  ⚠ APP_DEBUG=true — stack traces will be shown to visitors"

    if [ -n "$(env_value GOOGLE_CLIENT_ID)" ]; then
        echo "  Google      : configured — authorised redirect URI must be ${APP_URL}/auth/google/callback"
    else
        echo "  Google      : not configured (sign-in button hidden)"
    fi

    # --- public path --------------------------------------------------------
    PUBLIC_PATH=$(php artisan tinker --execute='echo public_path();' 2>/dev/null | tr -d '\r' || true)
    case "$PUBLIC_PATH" in
        */public_html) echo "  public path : $PUBLIC_PATH" ;;
        "")            echo "  public path : $(pwd)/public_html (tinker unavailable; assumed)" ;;
        *)             echo "✗ public path is $PUBLIC_PATH, expected …/public_html"; ok=0 ;;
    esac
    echo "  document root for the domain must be: $(pwd)/public_html"

    for f in public_html/index.php public_html/.htaccess public_html/build/manifest.json public_html/icon.svg public_html/manifest.webmanifest; do
        [ -f "$f" ] || { echo "✗ missing $f — if 'git ls-files -d' lists it, run ./deploy.sh (restores it); if it is under build/, run ./cx.sh 20 on a workstation"; ok=0; }
    done
    echo "  assets      : $(ls public_html/build/assets 2>/dev/null | wc -l | tr -d ' ') files"
    echo "  php (cli)   : $(php -r 'echo PHP_VERSION;' 2>/dev/null || echo unknown)"

    # The web server may run a different PHP than the shell (SiteGround's
    # PHP Manager sets it per domain). composer.lock needs >= 8.4; an older
    # web PHP shows "Composer detected issues in your platform" to visitors.
    if [ -n "$APP_URL" ] && command -v curl >/dev/null 2>&1; then
        PROBE="public_html/.phpv-$$.php"
        echo '<?php echo PHP_VERSION;' > "$PROBE"
        WEB_PHP=$(curl -sS --max-time 20 "$APP_URL/$(basename "$PROBE")" 2>/dev/null || true)
        rm -f "$PROBE"
        case "$WEB_PHP" in
            8.[4-9].*|8.[1-9][0-9].*|9.*) echo "  php (web)   : $WEB_PHP" ;;
            [0-9]*) echo "  php (web)   : $WEB_PHP"
                    echo "  ✗ web PHP is older than 8.4 — Site Tools → Devs → PHP Manager → $(echo "$APP_URL" | sed 's#https\?://##') → choose PHP 8.4+"
                    ok=0 ;;
            *)      echo "  php (web)   : (probe not served — document root or DNS issue)" ;;
        esac
    fi

    # --- live request -------------------------------------------------------
    # Hit the real URL from the server. This is what tells a Laravel problem
    # (500, log has the trace) apart from a hosting one (403: wrong document
    # root or permissions; 404: DNS or vhost not pointing at this account).
    if [ -n "$APP_URL" ] && command -v curl >/dev/null 2>&1; then
        for p in "" up build/manifest.json; do
            code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$APP_URL/$p" 2>/dev/null || echo 000)
            printf '  %-28s %s\n' "GET /$p" "$code"
            case "$code" in
                200|204) ;;
                403) echo "    ✗ Forbidden: in the hosting panel set the document root of the"
                     echo "      domain to $(pwd)/public_html (not the app root), then re-run."
                     ok=0 ;;
                404) [ -n "$p" ] && { echo "    ✗ not served from this checkout — check the document root"; ok=0; } ;;
                5*)  echo "    ✗ server error — see: tail -n 60 storage/logs/laravel.log"; ok=0 ;;
                000) echo "    ⚠ no response (DNS/TLS not ready, or outbound curl blocked)" ;;
            esac
        done
    fi

    php artisan route:list --except-vendor
    [ "$ok" = 1 ] || { echo "✗ verification failed"; exit 1; }
}

main() {
    if [ "$CHECK_ONLY" = 1 ]; then
        check_env
        verify
        echo "✓ checked $(git log --oneline -1)"
        return
    fi
    pull
    check_env
    prepare
    migrate_and_cache
    verify
    echo "✓ deployed $(git log --oneline -1)"
}

main "$@"
