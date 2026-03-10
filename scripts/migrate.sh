#!/usr/bin/env bash
# Migration script for users moving from the old metagraph-monitoring-service.
# Reads config and custom conditions from the old repo and generates new config.
#
# Usage:
#   ./scripts/migrate.sh /path/to/old-metagraph-monitoring-service
#   ./scripts/migrate.sh /path/to/old-repo --auth admin:password123
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
BLUE='\033[1;34m'
GREEN='\033[1;32m'
RED='\033[1;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${BLUE}[migrate]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}  ✓${NC} $*" >&2; }
err()  { echo -e "${RED}  ✗${NC} $*" >&2; }
warn() { echo -e "${YELLOW}  !${NC} $*" >&2; }

check_dependencies() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      err "$cmd is required but not installed."
      exit 1
    fi
  done
}

fetch_l0_nodes() {
  local network="$1"
  local url="https://l0-lb-${network}.constellationnetwork.io/cluster/info"
  log "Fetching L0 nodes from ${network}..."
  local response
  response=$(curl -sf --connect-timeout 10 "$url" 2>/dev/null) || {
    warn "Could not reach $url"
    echo "[]"
    return 1
  }
  echo "$response" | jq -c '[.[] | {ip: .ip, port: .publicPort, id: .id}] | .[0:3]' 2>/dev/null || echo "[]"
}

host_to_container_path() {
  local host_path="$1"
  echo "/root/.ssh/$(basename "$host_path")"
}

# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

main() {
  check_dependencies

  local old_repo="" auth_username="" auth_password="" auth_arg=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --auth)
        auth_arg="$2"
        auth_username="${auth_arg%%:*}"
        auth_password="${auth_arg#*:}"
        shift 2
        ;;
      -h|--help)
        echo "Usage:"
        echo "  ./scripts/migrate.sh /path/to/old-metagraph-monitoring-service"
        echo "  ./scripts/migrate.sh /path/to/old-repo --auth admin:password123"
        exit 0
        ;;
      *)
        old_repo="$1"
        shift
        ;;
    esac
  done

  if [ -z "$old_repo" ]; then
    err "Please provide path to old metagraph-monitoring-service."
    echo "Usage: ./scripts/migrate.sh /path/to/old-repo"
    exit 1
  fi

  old_repo=$(cd "$old_repo" && pwd)

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Metagraph Monitoring - Migration Tool${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""

  # ── Step 1: Find old config ──────────────────────────────────────────────

  local old_config=""
  if [ -f "$old_repo/config/config.json" ]; then
    old_config="$old_repo/config/config.json"
  else
    # Look for any .json in config/
    for f in "$old_repo"/config/*.json; do
      [ -f "$f" ] && old_config="$f" && break
    done
  fi

  if [ -z "$old_config" ] || [ ! -f "$old_config" ]; then
    err "Could not find config.json in $old_repo/config/"
    exit 1
  fi

  log "Found config: $old_config"

  # Validate it's a metagraph config
  if ! jq -e '.metagraph.id' "$old_config" &>/dev/null; then
    err "Config file does not contain metagraph.id - not a valid metagraph config"
    exit 1
  fi

  # ── Step 2: Extract metagraph info ───────────────────────────────────────

  local mg_name mg_id mg_network
  mg_name=$(jq -r '.metagraph.name // "migrated-metagraph"' "$old_config")
  mg_id=$(jq -r '.metagraph.id' "$old_config")
  mg_network=$(jq -r '.network.name // "mainnet"' "$old_config")

  # Sanitize name for filename (lowercase, replace spaces/special chars)
  local mg_slug
  mg_slug=$(echo "$mg_name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')

  ok "Metagraph: $mg_name ($mg_id)"
  ok "Network: $mg_network"

  # ── Step 3: Migrate nodes + SSH keys ─────────────────────────────────────

  local node_count
  node_count=$(jq '.metagraph.nodes | length' "$old_config")
  ok "Found $node_count node(s)"

  mkdir -p "$PROJECT_DIR/ssh-keys"

  # Remove existing entries for this metagraph (idempotent re-run)
  if [ -f "$PROJECT_DIR/.ssh-key-map" ]; then
    sed -i.bak "/^${mg_slug}:/d" "$PROJECT_DIR/.ssh-key-map"
    rm -f "$PROJECT_DIR/.ssh-key-map.bak"
  else
    touch "$PROJECT_DIR/.ssh-key-map"
  fi

  # Build new nodes array with updated privateKeyPath
  local new_nodes="["
  for (( i=0; i<node_count; i++ )); do
    local old_key_path
    old_key_path=$(jq -r ".metagraph.nodes[$i].privateKeyPath // \"\"" "$old_config")

    local container_path="/root/.ssh/id_rsa"
    local host_path="\$HOME/.ssh/id_rsa"

    if [ -n "$old_key_path" ] && [ "$old_key_path" != "null" ]; then
      local key_filename
      key_filename=$(basename "$old_key_path")

      # Try to resolve and copy the key file
      local resolved_key=""
      if [[ "$old_key_path" = /* ]]; then
        resolved_key="$old_key_path"
      else
        resolved_key="$old_repo/$old_key_path"
      fi

      if [ -f "$resolved_key" ]; then
        cp "$resolved_key" "$PROJECT_DIR/ssh-keys/$key_filename"
        chmod 600 "$PROJECT_DIR/ssh-keys/$key_filename"
        ok "Copied SSH key: $key_filename"
        host_path="./ssh-keys/$key_filename"
      else
        warn "SSH key not found: $resolved_key - using path as-is"
        host_path="$old_key_path"
      fi

      container_path="/root/.ssh/$key_filename"
    fi

    echo "${mg_slug}:${container_path}=${host_path}" >> "$PROJECT_DIR/.ssh-key-map"

    # Build node JSON - strip password/privateKeyPassword, update privateKeyPath
    local node_json
    node_json=$(jq -c ".metagraph.nodes[$i] | del(.password, .privateKeyPassword) | .privateKeyPath = \"$container_path\"" "$old_config")

    [ "$i" -gt 0 ] && new_nodes="${new_nodes},"
    new_nodes="${new_nodes}${node_json}"
  done
  new_nodes="${new_nodes}]"

  # ── Step 4: Fetch L0 nodes ──────────────────────────────────────────────

  local network_nodes_json
  network_nodes_json=$(fetch_l0_nodes "$mg_network") || {
    warn "Falling back to existing network nodes from old config"
    network_nodes_json=$(jq -c '.network.nodes // []' "$old_config")
  }

  local l0_count
  l0_count=$(echo "$network_nodes_json" | jq 'length')
  ok "L0 network nodes: $l0_count"

  # ── Step 5: Build new config (lean - only essential fields) ─────────────

  local layers_json
  layers_json=$(jq -c '
    .metagraph.layers | to_entries | map(
      .value |= {
        ports: .ports
      } + (if .ignore_layer == true then {ignore_layer: true} else {} end)
    ) | from_entries
  ' "$old_config")

  local new_config
  new_config=$(jq -n \
    --arg id "$mg_id" \
    --arg name "$mg_name" \
    --argjson nodes "$new_nodes" \
    --argjson layers "$layers_json" \
    --arg network "$mg_network" \
    --argjson network_nodes "$network_nodes_json" \
    '{
      metagraph: {
        id: $id,
        name: $name,
        layers: $layers,
        nodes: $nodes
      },
      network: {
        name: $network,
        nodes: $network_nodes
      }
    }')

  # ── Step 5b: Integrations (prompted or empty in non-interactive) ────────

  local mg_discord="" mg_opsgenie="" mg_aws_key="" mg_aws_secret="" mg_aws_region=""
  if [ -z "$auth_arg" ]; then
    echo -e "\n${CYAN}─── Integrations for $mg_name ───${NC}"
    read -rp "  Discord webhook URL (press Enter to skip): " mg_discord
    read -rp "  Opsgenie API key (press Enter to skip): " mg_opsgenie
    read -rp "  AWS Access Key ID (press Enter to skip): " mg_aws_key
    if [ -n "$mg_aws_key" ]; then
      read -rp "  AWS Secret Access Key: " mg_aws_secret
      read -rp "  AWS Region [us-west-1]: " mg_aws_region
      mg_aws_region="${mg_aws_region:-us-west-1}"
    fi
  fi

  local integrations='{}'
  [ -n "$mg_opsgenie" ] && integrations=$(echo "$integrations" | jq --arg v "$mg_opsgenie" '.opsgenie_api_key = $v')
  [ -n "$mg_discord" ] && integrations=$(echo "$integrations" | jq --arg v "$mg_discord" '.discord_webhook_url = $v')
  if [ -n "$mg_aws_key" ]; then
    integrations=$(echo "$integrations" | jq \
      --arg key "$mg_aws_key" --arg secret "$mg_aws_secret" --arg region "${mg_aws_region:-us-west-1}" \
      '.aws = {access_key_id: $key, secret_access_key: $secret, region: $region}')
  fi

  mkdir -p "$PROJECT_DIR/config"
  echo "$new_config" | jq --argjson integrations "$integrations" '. + {integrations: $integrations}' > "$PROJECT_DIR/config/${mg_slug}.config.json"
  ok "Generated config/${mg_slug}.config.json"

  # ── Step 6: Migrate custom restart conditions ────────────────────────────

  local custom_dirs=("$old_repo/src/custom-restart" "$old_repo/src/custom-restart-conditions")
  local migrated_conditions=0

  mkdir -p "$PROJECT_DIR/custom-conditions"

  for custom_dir in "${custom_dirs[@]}"; do
    [ -d "$custom_dir" ] || continue

    for ts_file in "$custom_dir"/*.ts; do
      [ -f "$ts_file" ] || continue
      local filename
      filename=$(basename "$ts_file")

      # Copy and rewrite imports to use internal path aliases
      sed \
        -e 's|from .*@constellation-network/metagraph-monitoring-service-local/interfaces.*|from '\''@core/interfaces'\'';|g' \
        -e 's|from .*@constellation-network/metagraph-monitoring-service/interfaces.*|from '\''@core/interfaces'\'';|g' \
        -e 's|from .*@constellation-network/metagraph-monitoring-service-local/restart-groups.*|from '\''@core/monitor/restart/groups'\'';|g' \
        -e 's|from .*@constellation-network/metagraph-monitoring-service/restart-groups.*|from '\''@core/monitor/restart/groups'\'';|g' \
        -e 's|from .*@constellation-network/metagraph-monitoring-service-local.*|from '\''@core/MonitoringConfiguration'\'';|g' \
        -e 's|from .*@constellation-network/metagraph-monitoring-service['\''"]|from '\''@core/MonitoringConfiguration'\''|g' \
        "$ts_file" > "$PROJECT_DIR/custom-conditions/$filename"

      ok "Migrated custom condition: $filename"
      migrated_conditions=$((migrated_conditions + 1))
    done
  done

  if [ "$migrated_conditions" -gt 0 ]; then
    ok "Migrated $migrated_conditions custom condition(s)"
    warn "Review custom-conditions/*.ts - you may need to update FullMetagraph constructor calls"
  fi

  # ── Step 7: Dashboard credentials + .env ─────────────────────────────────

  mkdir -p "$PROJECT_DIR/envs"

  if [ -f "$PROJECT_DIR/envs/.env.shared" ]; then
    ok "Preserving existing envs/.env.shared (use --auth to override credentials)"
  else
    if [ -z "$auth_username" ]; then
      echo ""
      echo -e "${CYAN}─── Dashboard Credentials ───${NC}"
      read -rp "  Username [admin]: " auth_username
      auth_username="${auth_username:-admin}"
      while true; do
        read -rsp "  Password: " auth_password
        echo ""
        [ -n "$auth_password" ] && break
        echo "  (required)"
      done
    fi

    local jwt_secret
    jwt_secret=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 64 2>/dev/null || openssl rand -hex 32)

    cat > "$PROJECT_DIR/envs/.env.shared" <<EOF
# Authentication (shared across all monitor containers)
AUTH_USERNAME=$auth_username
AUTH_PASSWORD=$auth_password
JWT_SECRET=$jwt_secret

# API
API_PORT=3001
CORS_ORIGIN=http://localhost:3000
EOF
    ok "Generated envs/.env.shared"
  fi

  # ── Step 8: Generate docker-compose.yml ──────────────────────────────────

  # Collect ALL metagraph names
  local all_names=()
  for f in "$PROJECT_DIR"/config/*.config.json; do
    [ -f "$f" ] || continue
    all_names+=("$(basename "$f" .config.json)")
  done

  # Generate docker-compose inline
  {
    echo "# Auto-generated by migrate.sh - do not edit manually."
    echo "# Re-run ./scripts/setup.sh to modify."
    echo ""
    echo "services:"

    local backends="" depends_list=""
    for name in "${all_names[@]}"; do
      local service_name="monitor-${name}"
      local config_file_path="$PROJECT_DIR/config/${name}.config.json"

      # Build SSH volume mounts
      local ssh_volumes=""
      if [ -f "$config_file_path" ]; then
        local keys
        keys=$(jq -r '.metagraph.nodes[].privateKeyPath' "$config_file_path" 2>/dev/null | sort -u)
        while IFS= read -r container_path; do
          [ -z "$container_path" ] && continue
          local fname
          fname=$(basename "$container_path")
          local hpath
          hpath=$(grep "^${name}:${container_path}=" "$PROJECT_DIR/.ssh-key-map" 2>/dev/null | head -1 | cut -d= -f2) || hpath=""
          [ -z "$hpath" ] && hpath="\${HOME}/.ssh/$fname"
          ssh_volumes="${ssh_volumes}      - ${hpath}:${container_path}:ro
"
        done <<< "$keys"
      fi

      cat <<SVCEOF
  ${service_name}:
    build:
      context: .
      dockerfile: Dockerfile
    env_file: ./envs/.env.shared
    environment:
      - NODE_ENV=production
      - API_PORT=3001
    volumes:
      - ./config/${name}.config.json:/app/config/${name}.config.json:ro
      - ./custom-conditions:/app/custom-conditions:ro
      - ./logs/${name}:/app/logs
${ssh_volumes}    restart: unless-stopped

SVCEOF

      [ -n "$backends" ] && backends="${backends},"
      backends="${backends}${name}=http://${service_name}:3001"
      depends_list="${depends_list}      - ${service_name}
"
    done

    cat <<GWEOF
  gateway:
    build:
      context: .
      dockerfile: Dockerfile.gateway
    ports:
      - '3001:3001'
    env_file: ./envs/.env.shared
    environment:
      - GATEWAY_PORT=3001
      - CORS_ORIGIN=http://localhost:3000
      - METAGRAPH_BACKENDS=${backends}
    depends_on:
${depends_list}    restart: unless-stopped

  ui:
    build:
      context: .
      dockerfile: Dockerfile.ui
    ports:
      - '3000:3000'
    environment:
      - API_URL=http://gateway:3001
    depends_on:
      - gateway
    restart: unless-stopped
GWEOF
  } > "$PROJECT_DIR/docker-compose.yml"

  ok "Generated docker-compose.yml"

  # Create log directories
  for name in "${all_names[@]}"; do
    mkdir -p "$PROJECT_DIR/logs/$name"
  done

  # ── Summary ──────────────────────────────────────────────────────────────

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Migration Complete!${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Metagraph: $mg_name ($mg_id)"
  echo "  Network:   $mg_network"
  echo "  Nodes:     $node_count"
  echo "  Custom conditions: $migrated_conditions"
  echo ""
  echo "  Generated files:"
  echo "    config/${mg_slug}.config.json"
  echo "    envs/.env.shared"
  echo "    docker-compose.yml"
  [ "$migrated_conditions" -gt 0 ] && echo "    custom-conditions/*.ts"
  echo ""
  echo -e "  Dashboard: ${CYAN}http://localhost:3000${NC}"
  echo ""

  if [ -z "$auth_arg" ]; then
    local start_now
    read -rp "  Start containers now? (y/n) [y]: " start_now
    start_now="${start_now:-y}"
    if [[ "$start_now" =~ ^[Yy] ]]; then
      "$SCRIPT_DIR/deploy.sh" --start
    else
      echo ""
      log "To start later: ./scripts/deploy.sh --start"
    fi
  else
    log "To start: ./scripts/deploy.sh --start"
  fi
}

main "$@"
