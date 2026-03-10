#!/usr/bin/env bash
# Idempotent deployment script for Metagraph Monitoring Service.
# Installs Docker, Docker Compose, and starts the monitoring stack.
#
# Usage:
#   ./scripts/deploy.sh                                     # Local: install deps + build + start
#   ./scripts/deploy.sh --install                           # Local: only install Docker
#   ./scripts/deploy.sh --start                             # Local: only build and start containers
#   ./scripts/deploy.sh --remote user@host                  # Remote: full deploy via SSH
#   ./scripts/deploy.sh --remote user@host --start          # Remote: build + start only
#   ./scripts/deploy.sh --remote user@host --key ~/.ssh/key # Remote: custom SSH key
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() { echo -e "\033[1;34m[deploy]\033[0m $*"; }
ok()  { echo -e "\033[1;32m[deploy]\033[0m $*"; }
err() { echo -e "\033[1;31m[deploy]\033[0m $*" >&2; }

# --------------------------------------------------------------------------
# 1. Install Docker (if not present)
# --------------------------------------------------------------------------
install_docker() {
  if command -v docker &>/dev/null; then
    ok "Docker already installed: $(docker --version)"
    return
  fi

  log "Installing Docker..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif command -v yum &>/dev/null; then
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
    sudo curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  else
    err "Unsupported package manager. Install Docker manually: https://docs.docker.com/engine/install/"
    exit 1
  fi

  ok "Docker installed: $(docker --version)"
}

# --------------------------------------------------------------------------
# 2. Ensure Docker is running and user has permission
# --------------------------------------------------------------------------
ensure_docker_running() {
  if ! sudo systemctl is-active --quiet docker 2>/dev/null; then
    log "Starting Docker service..."
    sudo systemctl start docker
    sudo systemctl enable docker
  fi

  if ! groups | grep -q docker; then
    log "Adding $(whoami) to docker group..."
    sudo usermod -aG docker "$(whoami)" 2>/dev/null || true
  fi

  ok "Docker service is running"
}

# --------------------------------------------------------------------------
# 3. Verify Docker Compose is available
# --------------------------------------------------------------------------
verify_compose() {
  if docker compose version &>/dev/null; then
    ok "Docker Compose available: $(docker compose version --short)"
    return
  fi

  if command -v docker-compose &>/dev/null; then
    ok "Docker Compose (standalone) available: $(docker-compose version --short)"
    return
  fi

  err "Docker Compose not found. Install it: https://docs.docker.com/compose/install/"
  exit 1
}

# --------------------------------------------------------------------------
# 4. Ensure project directory structure
# --------------------------------------------------------------------------
ensure_project_structure() {
  log "Ensuring project directories exist..."
  mkdir -p "$PROJECT_DIR/config"
  mkdir -p "$PROJECT_DIR/logs"
  mkdir -p "$PROJECT_DIR/custom-conditions"
  mkdir -p "$PROJECT_DIR/ssh-keys"
  ok "Project structure verified"
}

# --------------------------------------------------------------------------
# 5. Validate configuration
# --------------------------------------------------------------------------
validate_config() {
  if [ ! -f "$PROJECT_DIR/envs/.env.shared" ]; then
    err "No envs/.env.shared file found. Run ./scripts/setup.sh first."
    exit 1
  fi

  local config_count
  config_count=$(find "$PROJECT_DIR/config" -name "*.config.json" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$config_count" -eq 0 ]; then
    err "No config files found in $PROJECT_DIR/config/"
    err "Run ./scripts/setup.sh first to configure your metagraphs."
    exit 1
  fi

  if [ ! -f "$PROJECT_DIR/docker-compose.yml" ]; then
    err "No docker-compose.yml found. Run ./scripts/setup.sh first."
    exit 1
  fi

  ok "Found $config_count metagraph config file(s)"
}

# --------------------------------------------------------------------------
# 6. Build and start containers
# --------------------------------------------------------------------------
build_and_start() {
  log "Building and starting Docker containers..."
  cd "$PROJECT_DIR"

  docker compose build --parallel 2>&1 | tail -5

  docker compose up -d

  ok "Containers started successfully"
  echo ""
  docker compose ps
  echo ""
  ok "Dashboard:  http://localhost:3000"
  ok "API:        http://localhost:3001/api/health"
  ok "Swagger:    http://localhost:3001/api/docs"
}

# --------------------------------------------------------------------------
# 7. Remote deployment via SSH + rsync
# --------------------------------------------------------------------------
deploy_remote() {
  local remote_host="$1"
  local ssh_key="$2"
  local mode="$3"

  local ssh_opts="-o StrictHostKeyChecking=accept-new"
  [ -n "$ssh_key" ] && ssh_opts="$ssh_opts -i $ssh_key"

  # Validate local files exist before transferring
  validate_config

  # Check rsync is available
  if ! command -v rsync &>/dev/null; then
    err "rsync is required for remote deployment. Install it first."
    exit 1
  fi

  local remote_dir="~/metagraph-monitoring"

  log "Syncing project to $remote_host:$remote_dir ..."
  rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'logs/*' \
    --exclude '.next' \
    --exclude 'dist' \
    --exclude '.DS_Store' \
    -e "ssh $ssh_opts" \
    "$PROJECT_DIR/" "${remote_host}:${remote_dir}/"

  ok "Files synced to $remote_host"

  log "Running deploy on $remote_host ..."
  # shellcheck disable=SC2029
  ssh $ssh_opts "$remote_host" \
    "cd $remote_dir && chmod +x scripts/*.sh && ./scripts/deploy.sh $mode"

  ok "Remote deployment complete"
  ok "Dashboard:  http://${remote_host##*@}:3000"
  ok "API:        http://${remote_host##*@}:3001/api/health"
}

# --------------------------------------------------------------------------
# Local deployment (existing logic)
# --------------------------------------------------------------------------
deploy_local() {
  local mode="$1"

  case "$mode" in
    --install)
      install_docker
      ensure_docker_running
      verify_compose
      ensure_project_structure
      ;;
    --start)
      verify_compose
      validate_config
      build_and_start
      ;;
    *)
      install_docker
      ensure_docker_running
      verify_compose
      ensure_project_structure
      validate_config
      build_and_start
      ;;
  esac
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
main() {
  local mode="all" remote_host="" ssh_key=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --install) mode="--install"; shift ;;
      --start)   mode="--start"; shift ;;
      --remote)  remote_host="$2"; shift 2 ;;
      --key)     ssh_key="$2"; shift 2 ;;
      -h|--help)
        echo "Usage:"
        echo "  ./scripts/deploy.sh                          # Local: full deploy"
        echo "  ./scripts/deploy.sh --install                # Local: install Docker only"
        echo "  ./scripts/deploy.sh --start                  # Local: build + start only"
        echo "  ./scripts/deploy.sh --remote user@host       # Remote: full deploy"
        echo "  ./scripts/deploy.sh --remote user@host --start  # Remote: build + start"
        echo "  ./scripts/deploy.sh --remote user@host --key ~/.ssh/key  # Custom SSH key"
        exit 0
        ;;
      *) shift ;;
    esac
  done

  log "Metagraph Monitoring Service - Deployment"
  log "Project: $PROJECT_DIR"
  echo ""

  if [ -n "$remote_host" ]; then
    deploy_remote "$remote_host" "$ssh_key" "$mode"
  else
    deploy_local "$mode"
  fi

  ok "Done!"
}

main "$@"
