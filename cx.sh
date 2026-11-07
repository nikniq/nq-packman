#!/bin/bash
#================================================================
# Operations menu — cx.sh
#
#   ./cx.sh            # interactive menu
#   ./cx.sh 20         # run an option directly
#   ./cx.sh 33 "about" # …with a second parameter
#
# Runs in the TARGET environment (the server, from the app root), where
# every option executes directly. It also works from a workstation: there
# it detects it is not the server and sends the same commands over SSH.
#
# No vars.sh: the server settings live in the block below. They are not
# secrets (SSH authenticates with your key), and every one can be
# overridden for a session with an environment variable, e.g.
#
#   REMOTE_HOST=staging.example.com ./cx.sh 30
#
# Version 1.2 (nq-packman)
# - runs on the server itself (no SSH hop) or from a workstation.
# - settings built in; vars.sh no longer needed.
# - 36 diagnoses a 403/500 (document root, permissions, live request).
# - the Vite bundle (public_html/build) is committed because the server
#   cannot run the bundler; 20 rebuilds it locally before deploying.
#================================================================
clear

#---------------------------------------------------------------
# Settings (override with environment variables of the same name)
#---------------------------------------------------------------
PROJECT="${PROJECT:-nq-packman}"
DOMAIN="${DOMAIN:-packman.nikniq.com}"          # the site's hostname
REMOTE_USER="${REMOTE_USER:-u4-bg8uegu57tjw}"   # SiteGround SSH user
REMOTE_HOST="${REMOTE_HOST:-ssh.nikniq.com}"
REMOTE_PORT="${REMOTE_PORT:-18765}"             # SiteGround's SSH port
REMOTE="$REMOTE_USER@$REMOTE_HOST"
REMOTE_APP="${REMOTE_APP:-www/$DOMAIN}"         # app root, relative to ~
APP_URL="${APP_URL:-https://$DOMAIN}"
APP_SSH="${APP_SSH:-ssh -p $REMOTE_PORT}"
APP_SCP="${APP_SCP:-scp -P $REMOTE_PORT}"

# On the server (same account, or sitting in an app root) run directly;
# anywhere else, ssh to the server for the remote steps.
if [ "$(whoami)" = "$REMOTE_USER" ] || [ -f artisan -a -f deploy.sh -a ! -d node_modules -a -n "${SSH_CONNECTION:-}" ]; then
  ON_SERVER=1; WHERE="here"
else
  ON_SERVER=0; WHERE="$REMOTE:~/$REMOTE_APP"
fi

#---------------------------------------------------------------
# Helpers
#---------------------------------------------------------------

log_history() {
  mkdir -p ./log
  touch ./log/history.log
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" > tmpfile
  cat ./log/history.log >> tmpfile && mv tmpfile ./log/history.log
}

# Run a command in the app directory on the server. On the server itself
# that is a plain shell; elsewhere it goes over SSH.
remote() {
  if [ "$ON_SERVER" = 1 ]; then bash -c "$*"; else $APP_SSH "$REMOTE" "cd ~/$REMOTE_APP && $*"; fi
}

# Same, with a terminal attached — for anything interactive or long-running.
remote_tty() {
  if [ "$ON_SERVER" = 1 ]; then bash -c "$*"; else $APP_SSH -t "$REMOTE" "cd ~/$REMOTE_APP && $*"; fi
}

need_param() {
  if [ -z "$PARAM2" ]; then
    read -r -p "$1: " PARAM2
  fi
}

banner() {
  echo ===========================================================
  echo "$1"
  echo ===========================================================
}

# Gate for anything that drops the site or is hard to undo.
confirm() {
  echo "⚠ $1"
  read -r -p "Type 'yes' to continue: " reply
  [ "$reply" = "yes" ] || { echo "Skipped $SELECTION."; exit 0; }
}

echo =============================================================
echo "Hi $(whoami)@$(hostname -s) — acting on $PROJECT ($WHERE)"
echo What do you want to do?
echo -------------------------------------------------------------
echo "ROUTINE — day to day"
echo "20 : DEPLOY: pull + caches + verify on $PROJECT"
echo "22 : WHAT'S LIVE: compare the server's HEAD with local"
echo "24 : CACHES: refresh config/routes/views"
echo "25 : CACHES: clear everything (when a cached value looks stale)"
echo "26 : COMPOSER: install production dependencies"
echo ----------------------------------------------
echo DIAGNOSE
echo "30 : HEALTH: $APP_URL — page, assets and /up"
echo "31 : LOGS: tail the Laravel log"
echo "32 : LOGS: last errors"
echo "33 : ARTISAN: run a command (e.g. 'about')"
echo "34 : CONFIG: key settings on the server (secrets hidden)"
echo "35 : DISK: what is using the account quota"
echo "36 : WHY 403/500: document root, permissions and a live request from the server"
echo ----------------------------------------------
echo MAINTENANCE
echo "72 : MAINTENANCE MODE: on  [site goes down]"
echo "73 : MAINTENANCE MODE: off"
echo "74 : LOGS: truncate the Laravel log  [discards log history]"
echo ----------------------------------------------
echo "SOURCE"
echo "90 : COMMIT + PUSH: stage everything, commit with a message, push"
echo "91 : STATUS: local changes and unpushed commits"
echo ----------------------------------------------
echo ACCESS
echo "00 : CONNECT: to $REMOTE"
echo "01 : FIRST-TIME SETUP: clone the repo on the server"
echo "qq : Exit [Quit]"
echo Enter [Selection] to continue
echo =============================================================
if [ -n "$1" ]; then
  SELECTION=$1
else
  read -n 2 SELECTION
fi
PARAM2="${2:-}"
echo
echo Your selection is : $SELECTION.


case "$SELECTION" in

  #-------------------------------------------------------------
  # ROUTINE
  #-------------------------------------------------------------

  "20" )
  banner "DEPLOY: $PROJECT"
  if [ "$ON_SERVER" = 1 ]; then
    ./deploy.sh
    log_history "Deployed $PROJECT"
    exit $?
  fi
  # From a workstation: the server only pulls, so the Vite bundle must be
  # built here and committed. Rebuild first so a stale bundle cannot ship.
  echo "→ npm run build"
  npm run build --silent || { echo "✗ build failed — not deploying"; exit 1; }
  if [ -n "$(git status --porcelain public_html/build)" ]; then
    echo "⚠ public_html/build changed — commit it (option 90) before deploying."
    echo
  fi
  # The server deploys by pulling from git, so anything not pushed is not
  # deployed. Without this check the deploy "succeeds" on the previous
  # commit and the change appears to have silently done nothing.
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠ Uncommitted local changes — these will NOT deploy:"
    git status --short
    echo
  fi
  UNPUSHED=$(git log --oneline @{u}.. 2>/dev/null)
  if [ -n "$UNPUSHED" ]; then
    echo "⚠ Commits not pushed — these will NOT deploy:"
    echo "$UNPUSHED"
    echo
    read -r -p "Deploy anyway? Type 'yes' to continue: " confirm
    [ "$confirm" = "yes" ] || { echo "Skipped $SELECTION"; exit 0; }
  fi
  echo "Local HEAD : $(git log --oneline -1)"
  echo
  remote_tty "./deploy.sh"
  log_history "Deployed $PROJECT"
  ;;


  "22" )
  banner "WHAT'S LIVE on $PROJECT"
  echo "--- server ---"
  remote "git log --oneline -3 && git status --short"
  echo
  echo "--- local ---"
  git log --oneline -3
  echo
  LOCAL_HEAD=$(git rev-parse HEAD 2>/dev/null)
  SERVER_HEAD=$(remote "git rev-parse HEAD" 2>/dev/null | tr -d '\r')
  if [ "$LOCAL_HEAD" = "$SERVER_HEAD" ]; then
    echo "✓ server matches local HEAD"
  else
    echo "✗ server is NOT on your local HEAD"
    echo "  local : $LOCAL_HEAD"
    echo "  server: $SERVER_HEAD"
  fi
  ;;


  "24" )
  banner "CACHES: refresh on $PROJECT"
  remote "php artisan optimize"
  log_history "Refreshed caches on $PROJECT"
  ;;


  "25" )
  banner "CACHES: clear everything on $PROJECT"
  # A stale config cache is why an .env change can appear to have been
  # ignored. deploy.sh rebuilds them, so run 24 after this.
  remote "php artisan optimize:clear"
  log_history "Cleared all caches on $PROJECT"
  ;;


  "26" )
  banner "COMPOSER: install production dependencies"
  remote_tty "composer install --no-dev --optimize-autoloader --no-interaction"
  log_history "Installed composer dependencies on $PROJECT"
  ;;


  #-------------------------------------------------------------
  # DIAGNOSE
  #-------------------------------------------------------------

  "30" )
  banner "HEALTH: $APP_URL"
  # Checked from here rather than on the server so it exercises the real
  # path in: DNS, TLS and the web server, not just PHP.
  for p in "" build/manifest.json icon.svg manifest.webmanifest robots.txt up; do
    printf '%-20s ' "/$p"
    curl -sS -o /dev/null -w '%{http_code}  %{time_total}s\n' --max-time 25 "$APP_URL/$p" || echo "✗ no response"
  done
  ;;


  "31" )
  banner "LOGS: tail on $PROJECT (Ctrl-C to stop)"
  remote_tty "tail -n 40 -f storage/logs/laravel.log"
  ;;


  "32" )
  banner "LOGS: recent errors on $PROJECT"
  remote "grep -nE '\.(ERROR|CRITICAL|ALERT|EMERGENCY):' storage/logs/laravel.log | tail -n 25" \
    || echo "No matching lines (or no log file yet)."
  ;;


  "33" )
  banner "ARTISAN on $PROJECT"
  need_param "artisan command (without the word 'artisan')"
  case "$PARAM2" in
    tinker*) echo "⚠ tinker needs an interactive PHP CLI; on shared hosting SSH php is often cgi-fcgi and will die." ;;
  esac
  remote_tty "php artisan $PARAM2"
  log_history "Ran artisan $PARAM2 on $PROJECT"
  ;;


  "34" )
  banner "CONFIG on $PROJECT"
  # Values are deliberately not printed for anything that looks like a
  # secret — this runs in a terminal that scrolls back.
  echo "--- environment ---"
  remote "grep -E '^(APP_ENV|APP_DEBUG|APP_URL|SESSION_DRIVER|CACHE_STORE|QUEUE_CONNECTION|LOG_CHANNEL)=' .env | sort"
  echo
  echo "--- keys present (values hidden) ---"
  remote "grep -oE '^[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*=' .env | tr -d '=' | sort | sed 's/^/  /'"
  ;;


  "35" )
  banner "DISK: quota and the biggest directories"
  remote "du -sh . 2>/dev/null; echo; echo 'largest directories:'; du -sh */ 2>/dev/null | sort -rh | head -12"
  ;;


  "36" )
  banner "WHY 403/500 on $APP_URL"
  # A 403 on the home page is a hosting problem, not a Laravel one: the
  # domain's document root is not ~/$REMOTE_APP/public_html, or the files
  # are too permissive for the host's PHP handler. deploy.sh --check prints
  # the expected document root, fixes nothing, and requests the site from
  # the server so DNS/CDN cannot confuse the picture.
  echo "--- from here ---"
  for p in "" up; do
    printf '%-20s ' "/$p"
    curl -sS -o /dev/null -w '%{http_code}  server=%{content_type}\n' --max-time 25 "$APP_URL/$p" || echo "✗ no response"
  done
  echo
  echo "--- on the server ---"
  remote "echo \"app root : \$(pwd)\"; ls -ld . public_html public_html/index.php public_html/.htaccess 2>&1; echo; ./deploy.sh --check" \
    || echo "✗ ./deploy.sh --check failed — see the messages above (if the app root is missing, run 01)."
  echo
  echo "If GET / is 403: Site Tools → Domain → Manage Domain → set the document root"
  echo "to ~/$REMOTE_APP/public_html, then run 36 again."
  ;;


  #-------------------------------------------------------------
  # MAINTENANCE
  #-------------------------------------------------------------

  "72" )
  banner "MAINTENANCE MODE: on"
  confirm "This takes $APP_URL down for every visitor until 73 is run."
  remote "php artisan down"
  log_history "Maintenance mode ON for $PROJECT"
  ;;


  "73" )
  banner "MAINTENANCE MODE: off"
  remote "php artisan up"
  log_history "Maintenance mode OFF for $PROJECT"
  ;;


  "74" )
  banner "LOGS: truncate the Laravel log"
  confirm "This discards the whole server log history."
  remote ": > storage/logs/laravel.log && ls -lh storage/logs/laravel.log"
  log_history "Truncated Laravel log on $PROJECT"
  ;;


  #-------------------------------------------------------------
  # SOURCE
  #-------------------------------------------------------------

  "90" )
  banner "COMMIT + PUSH"
  [ "$ON_SERVER" = 1 ] && { echo "Commit from your workstation, not the server; the server only pulls (20)."; exit 0; }
  git status --short
  if [ -z "$(git status --porcelain)" ]; then
    echo "Nothing to commit."
  else
    need_param "Commit message"
    git add -A
    git commit -m "$PARAM2"
  fi
  git push
  log_history "Pushed $(git log --oneline -1)"
  ;;


  "91" )
  banner "STATUS"
  git status --short
  echo
  echo "--- unpushed ---"
  git log --oneline @{u}.. 2>/dev/null || echo "(no upstream set)"
  ;;


  #-------------------------------------------------------------
  # ACCESS
  #-------------------------------------------------------------

  "00" )
  banner "CONNECT: $REMOTE"
  [ "$ON_SERVER" = 1 ] && { echo "You are already on the server ($(pwd))."; exit 0; }
  $APP_SSH "$REMOTE"
  ;;


  "01" )
  banner "FIRST-TIME SETUP on $REMOTE"
  [ "$ON_SERVER" = 1 ] && { echo "Already set up here ($(pwd)). Run 20 to deploy or 36 to diagnose."; exit 0; }
  REPO_URL=$(git remote get-url origin)
  echo "Clones $REPO_URL into ~/$REMOTE_APP, installs dependencies, creates .env."
  echo "Afterwards set the domain's document root to ~/$REMOTE_APP/public_html"
  echo "(Site Tools → Domain → Manage Domain) and set APP_URL=$APP_URL in .env."
  confirm "Continue?"
  $APP_SSH -t "$REMOTE" "mkdir -p ~/$(dirname "$REMOTE_APP") && cd ~/$(dirname "$REMOTE_APP") \
    && git clone $REPO_URL $(basename "$REMOTE_APP") && cd $(basename "$REMOTE_APP") \
    && composer install --no-dev --optimize-autoloader --no-interaction \
    && cp -n .env.example .env \
    && sed -i -e 's#^APP_URL=.*#APP_URL=$APP_URL#' -e 's#^APP_ENV=.*#APP_ENV=production#' -e 's#^APP_DEBUG=.*#APP_DEBUG=false#' .env \
    && php artisan key:generate && ./deploy.sh"
  log_history "First-time setup of $PROJECT on $REMOTE"
  ;;


  "qq" )
  echo Bye.
  ;;


  * )
  echo "Unknown selection: $SELECTION"
  ;;

esac
