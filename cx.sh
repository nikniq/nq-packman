#!/bin/bash
#================================================================
# LOCAL command-line assistant — cx.sh
#
#   ./cx.sh            # interactive menu
#   ./cx.sh 20         # run an option directly
#   ./cx.sh 33 "about" # …with a second parameter
#
# ⚠ Runs on your LOCAL machine only — never copy this to the server.
#   Its counterpart on the server is deploy.sh (pull + caches + verify).
#
# Requires a vars.sh next to it defining REMOTE, PROJECT, APP_SSH, etc.
# See vars.sh.example. vars.sh is gitignored because it holds host and
# account details.
#
# Version 1.0 (nq-packman)
# - based on the nq-space-invaders cx.sh. Deploy, what's-live, caches,
#   composer, assets, health, logs, artisan, config, disk, maintenance
#   mode, commit-and-push, and a plain SSH connect.
# - 27 ASSETS builds the Vite bundle locally and uploads public_html/build,
#   for hosts without node (the build output is gitignored).
#================================================================
clear

if [ ! -f ./vars.sh ]; then
  echo "vars.sh not found next to cx.sh — copy vars.sh.example to vars.sh and fill it in."
  exit 1
fi
source ./vars.sh

REMOTE_APP="${REMOTE_APP:-www/$PROJECT}"
APP_URL="${APP_URL:-https://$PROJECT}"
LOG_OUTPUT="${LOG_OUTPUT:-./log/remote.out}"
APP_RSYNC="${APP_RSYNC:-rsync -az -e '$APP_SSH'}"

# This script drives the server from outside. Run on the server it would
# try to ssh to itself.
if [ "$(hostname -s 2>/dev/null)" = "${REMOTE_HOST%%.*}" ]; then
  echo "⚠ This looks like $REMOTE_HOST — cx.sh is the LOCAL script. Use deploy.sh here."
  exit 1
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

# Run a command on the server, in the app directory.
remote() {
  $APP_SSH "$REMOTE" "cd ~/$REMOTE_APP && $*"
}

# Same, with a terminal attached — for anything interactive or long-running.
remote_tty() {
  $APP_SSH -t "$REMOTE" "cd ~/$REMOTE_APP && $*"
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
echo "Hi $USER@$HOSTNAME — acting on $PROJECT ($REMOTE)"
echo What do you want to do?
echo -------------------------------------------------------------
echo "ROUTINE — day to day"
echo "20 : DEPLOY: pull + caches + verify on $PROJECT"
echo "22 : WHAT'S LIVE: compare the server's HEAD with local"
echo "24 : CACHES: refresh config/routes/views"
echo "25 : CACHES: clear everything (when a cached value looks stale)"
echo "26 : COMPOSER: install production dependencies"
echo "27 : ASSETS: build Vite bundle locally and upload public_html/build"
echo ----------------------------------------------
echo DIAGNOSE
echo "30 : HEALTH: $APP_URL — page, assets and /up"
echo "31 : LOGS: tail the Laravel log"
echo "32 : LOGS: last errors"
echo "33 : ARTISAN: run a command (e.g. 'about')"
echo "34 : CONFIG: key settings on the server (secrets hidden)"
echo "35 : DISK: what is using the account quota"
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


  "27" )
  banner "ASSETS: build locally, upload public_html/build to $PROJECT"
  # public_html/build is gitignored, so on a host without node it has to be
  # shipped from here. --delete removes stale hashed bundles so the server's
  # manifest and files always come from the same build.
  npm run build || { echo "✗ build failed"; exit 1; }
  eval "$APP_RSYNC --delete ./public_html/build/ \"$REMOTE:~/$REMOTE_APP/public_html/build/\""
  remote "ls public_html/build/manifest.json && php artisan view:clear"
  log_history "Uploaded assets to $PROJECT"
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
  $APP_SSH "$REMOTE"
  ;;


  "01" )
  banner "FIRST-TIME SETUP on $REMOTE"
  REPO_URL=$(git remote get-url origin)
  echo "Clones $REPO_URL into ~/$REMOTE_APP, installs dependencies, creates .env."
  echo "Afterwards point the web server's document root at ~/$REMOTE_APP/public_html"
  echo "and set APP_URL in .env."
  confirm "Continue?"
  $APP_SSH -t "$REMOTE" "mkdir -p ~/$(dirname "$REMOTE_APP") && cd ~/$(dirname "$REMOTE_APP") \
    && git clone $REPO_URL $(basename "$REMOTE_APP") && cd $(basename "$REMOTE_APP") \
    && composer install --no-dev --optimize-autoloader --no-interaction \
    && cp -n .env.example .env && php artisan key:generate && ./deploy.sh"
  log_history "First-time setup of $PROJECT on $REMOTE"
  ;;


  "qq" )
  echo Bye.
  ;;


  * )
  echo "Unknown selection: $SELECTION"
  ;;

esac
