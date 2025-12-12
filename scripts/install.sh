#!/usr/bin/env bash
set -euo pipefail

# Setup script for installing CodeX dependencies on Ubuntu-based systems.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_NODE_MAJOR=18
NODESOURCE_VERSION=20

log() { echo "[CodeX install] $*"; }
warn() { echo "[CodeX install][WARN] $*" >&2; }
err() { echo "[CodeX install][ERROR] $*" >&2; }

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

with_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    err "This script needs to run '$*' as root, but sudo is not available."
    exit 1
  fi
}

ensure_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    err "This installer currently supports Ubuntu/Debian systems with apt-get."
    exit 1
  fi
}

update_apt() {
  log "Updating apt package index..."
  with_sudo apt-get update -y
}

install_base_packages() {
  log "Installing base packages (curl, git, build essentials)..."
  with_sudo apt-get install -y ca-certificates curl git build-essential
}

node_major_version() {
  local version
  version=$(node -v 2>/dev/null || true)
  version=${version#v}
  echo "${version%%.*}"
}

ensure_node() {
  local major
  major=$(node_major_version)
  if [ -n "$major" ] && [ "$major" -ge "$REQUIRED_NODE_MAJOR" ]; then
    log "Detected Node.js $(node -v); skipping Node.js installation."
    return
  fi

  log "Installing Node.js ${NODESOURCE_VERSION}.x via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODESOURCE_VERSION}.x" | with_sudo bash -
  with_sudo apt-get install -y nodejs
}

install_global_tools() {
  log "Installing global Node.js tools (vercel CLI)..."
  npm install -g vercel@latest
}

install_project_dependencies() {
  log "Installing backend dependencies..."
  (cd "$ROOT_DIR/backend" && npm ci)

  log "Installing frontend dependencies..."
  (cd "$ROOT_DIR/frontend" && npm ci)
}

main() {
  ensure_apt
  require_command curl

  update_apt
  install_base_packages
  ensure_node
  install_global_tools
  install_project_dependencies

  log "Installation complete!"
  log "Backend dev: cd backend && npm run dev"
  log "Frontend dev: cd frontend && npm run dev"
}

main "$@"
