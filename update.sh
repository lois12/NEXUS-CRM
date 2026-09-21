#!/bin/bash
# NEXUS CRM — Deploy with reliable DB backup/restore
set -e

APP_DIR="/var/www/NEXUS-CRM"
LOG_FILE="/var/www/deploy.log"
DB_FILE="$APP_DIR/server/nexus.db"
BACKUP_DIR="/var/nexus_db_backups"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/nexus_${TIMESTAMP}.db"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
fail() { log "FAIL: $1"; exit 1; }

cd "$APP_DIR" || fail "Cannot cd to $APP_DIR"

# Save current commit for rollback
BEFORE=$(git rev-parse HEAD)
log "=== DEPLOY START === (from ${BEFORE:0:7})"

# ── BACKUP DB ──
mkdir -p "$BACKUP_DIR"
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_FILE"
    DB_SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || echo 0)
    log "DB backed up → $BACKUP_FILE (${DB_SIZE} bytes)"

    # Verify backup is a valid SQLite file (header starts with "SQLite format 3")
    HEADER=$(head -c 16 "$BACKUP_FILE" 2>/dev/null)
    if echo "$HEADER" | grep -q "SQLite format"; then
        log "Backup integrity: valid SQLite header"
    else
        fail "Backup file is NOT a valid SQLite database! Aborting deploy to protect data."
    fi

    # Keep only last 10 backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/nexus_*.db 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 10 ]; then
        ls -1t "$BACKUP_DIR"/nexus_*.db | tail -n +11 | xargs rm -f
        log "Cleaned old backups (kept last 10)"
    fi
else
    log "WARNING: No DB file found to backup!"
fi

# ── VERIFY .gitignore PROTECTS *.db ──
if ! grep -q '^\*\.db$' "$APP_DIR/.gitignore" 2>/dev/null; then
    if [ -f "$BACKUP_FILE" ]; then
        fail "DANGER: .gitignore does NOT contain *.db! Git could overwrite DB on pull. Deploy aborted. Backup is safe at $BACKUP_FILE"
    else
        fail "DANGER: .gitignore does NOT contain *.db and no backup exists! Aborting."
    fi
fi
log ".gitignore verified: *.db is protected"

# Pull latest
log "Pulling from GitHub..."
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Already up to date. Nothing to deploy."
    echo "DEPLOY_OK"
    exit 0
fi

git pull origin main 2>&1 | tee -a "$LOG_FILE"
AFTER=$(git rev-parse HEAD)
log "Pulled: ${BEFORE:0:7} -> ${AFTER:0:7}"

# ── VERIFY DB AFTER PULL ──
if [ -f "$BACKUP_FILE" ]; then
    if [ ! -f "$DB_FILE" ]; then
        log "DB DISAPPEARED after git pull! Restoring..."
        cp "$BACKUP_FILE" "$DB_FILE"
        log "DB restored from backup"
    else
        # Check DB header is still valid
        POST_HEADER=$(head -c 16 "$DB_FILE" 2>/dev/null)
        if ! echo "$POST_HEADER" | grep -q "SQLite format"; then
            log "DB CORRUPTED after git pull (bad header)! Restoring..."
            cp "$BACKUP_FILE" "$DB_FILE"
            log "DB restored from backup"
        fi
    fi
fi

# Install deps
log "Installing dependencies..."
cd client && npm install --legacy-peer-deps 2>&1 | tail -3 | tee -a "$LOG_FILE"
cd ../server && npm install 2>&1 | tail -3 | tee -a "$LOG_FILE"
cd ..

# Run server tests (warn only, don't block)
log "Running server tests..."
TEST_RESULT=0
cd server && npx vitest run 2>&1 | tee -a "$LOG_FILE" || TEST_RESULT=$?
cd ..
if [ $TEST_RESULT -eq 0 ]; then
    log "Server tests PASSED"
else
    log "WARNING: Server tests failed (code $TEST_RESULT) — continuing deploy"
fi

# STOP pm2 BEFORE build
log "Stopping pm2 for safe build..."
pm2 stop nexus-crm 2>&1 | tee -a "$LOG_FILE"
sleep 3

# Build frontend
log "Building frontend..."
if cd client && npm run build 2>&1 | tee -a "$LOG_FILE"; then
    log "Frontend build OK"
else
    log "Frontend build FAILED — rolling back!"
    cd ..
    git reset --hard "$BEFORE"
    pm2 start nexus-crm
    fail "Frontend build failed. Rolled back to ${BEFORE:0:7}"
fi
cd ..

# Build backend
log "Building backend..."
if cd server && npm run build 2>&1 | tee -a "$LOG_FILE"; then
    log "Backend build OK"
else
    log "Backend build FAILED — rolling back!"
    cd ..
    git reset --hard "$BEFORE"
    pm2 start nexus-crm
    fail "Backend build failed. Rolled back to ${BEFORE:0:7}"
fi
cd ..

# ── VERIFY DB AFTER BUILD ──
if [ -f "$BACKUP_FILE" ]; then
    if [ ! -f "$DB_FILE" ]; then
        log "DB DISAPPEARED after build! Restoring..."
        cp "$BACKUP_FILE" "$DB_FILE"
        log "DB restored from backup"
    else
        BUILD_HEADER=$(head -c 16 "$DB_FILE" 2>/dev/null)
        if ! echo "$BUILD_HEADER" | grep -q "SQLite format"; then
            log "DB CORRUPTED after build (bad header)! Restoring..."
            cp "$BACKUP_FILE" "$DB_FILE"
            log "DB restored from backup"
        else
            # Size sanity check
            DB_SIZE_NOW=$(stat -c%s "$DB_FILE" 2>/dev/null || echo 0)
            BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo 0)
            if [ "$BACKUP_SIZE" -gt 0 ] && [ "$DB_SIZE_NOW" -lt $((BACKUP_SIZE / 2)) ]; then
                log "DB shrank suspiciously (${BACKUP_SIZE} → ${DB_SIZE_NOW})! Restoring..."
                cp "$BACKUP_FILE" "$DB_FILE"
                log "DB restored from backup"
            else
                log "DB OK after build (${DB_SIZE_NOW} bytes)"
            fi
        fi
    fi
fi

# START pm2 after successful build
log "Starting pm2..."
pm2 start nexus-crm 2>&1 | tee -a "$LOG_FILE"

# Health check
sleep 3
if curl -sf http://localhost:8080/api/health > /dev/null 2>&1; then
    log "Health check PASSED"
else
    log "Health check FAILED — rolling back!"
    pm2 stop nexus-crm
    git reset --hard "$BEFORE"
    cd client && npm run build 2>&1 | tail -3
    cd ../server && npm run build 2>&1 | tail -3
    cd ..
    # Restore DB on rollback
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$DB_FILE"
        log "DB restored on rollback"
    fi
    pm2 start nexus-crm
    fail "Health check failed. Rolled back to ${BEFORE:0:7}"
fi

log "=== DEPLOY SUCCESS === ${BEFORE:0:7} -> ${AFTER:0:7}"
echo "DEPLOY_OK"
