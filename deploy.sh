#!/bin/bash

set -e  # Stop script on error

# ============================
# CONFIGURATION
# ============================
REPO_URL="git@github.com:ThanujaSamaraweera/Wastage-Calculator.git"
# Base directory where host-level files (like .env) are stored
BASE_DIR="/opt/projects/wastage_calculator"
# Sub-directory where the repository code is cloned
PROJECT_DIR="$BASE_DIR/app"
# Source of truth for your production .env file
SHARED_ENV_FILE="$BASE_DIR/.env"

echo "=========================================="
echo "🚀 Starting Basilur Wastage Calculator Deployment..."
echo "=========================================="

# ============================
# 0. Ensure Base Directory Exists
# ============================
mkdir -p "$BASE_DIR"

# ============================
# 1. Clone or Update Repository
# ============================
if [ -d "$PROJECT_DIR/.git" ]; then
    echo "📥 Updating existing repository..."
    cd "$PROJECT_DIR" || exit 1
    git remote set-url origin "$REPO_URL"
    git fetch origin main
    git reset --hard origin/main
    git clean -fd
else
    echo "📦 Cloning fresh repository from $REPO_URL..."
    if [ -d "$PROJECT_DIR" ]; then rm -rf "$PROJECT_DIR"; fi
    git clone "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR" || exit 1
fi

# ============================
# 2. Setup Environment Variables
# ============================
echo "🔐 Distributing environment variables..."

if [ -f "$SHARED_ENV_FILE" ]; then
    # Copy .env to project root for Docker Compose
    cp "$SHARED_ENV_FILE" "$PROJECT_DIR/.env"
    echo "✅ Production .env file copied successfully."
else
    echo "⚠️  WARNING: No shared .env file found at $SHARED_ENV_FILE!"
    echo "   Please create $SHARED_ENV_FILE on the server before running."
fi

# ============================
# 3. Docker Compose Build & Deploy
# ============================
echo "🔄 Building and launching containers..."

cd "$PROJECT_DIR" || exit 1

# Build and start services in detached mode (removing orphan containers)
docker compose up -d --build --remove-orphans

# Optional: Clean up dangling images to free disk space
docker image prune -f

echo "=========================================="
echo "✅ Basilur Wastage Calculator Deployed Successfully!"
echo "   - Application running on port 6000"
echo "=========================================="
