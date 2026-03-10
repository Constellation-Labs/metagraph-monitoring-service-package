# Metagraph Monitoring Service

Monitors your Constellation Network metagraph and automatically restarts nodes when issues are detected. Includes a web dashboard for real-time status, logs, and manual controls.

## Prerequisites

- **Docker** and **Docker Compose** (installed automatically by the deploy script, or manually)
- **SSH access** to your metagraph nodes (key-based authentication)
- **Password-less sudo** on both the monitoring instance and metagraph nodes ([guide](https://gcore.com/learning/how-to-disable-password-for-sudo-command/))
- `curl` and `jq` (for setup scripts)

## Quick Start

```bash
git clone https://github.com/Constellation-Labs/metagraph-monitoring-service.git
cd metagraph-monitoring-service

# Interactive setup wizard
./scripts/setup.sh

# Deploy (installs Docker if needed, builds, and starts)
./scripts/deploy.sh --start
```

The setup wizard will ask for:
- Dashboard credentials (username/password)
- Metagraph details (name, ID, network)
- Node IPs, SSH keys, and P12 key file info
- Layer configuration (ML0, CL1, DL1)
- Optional integrations (Discord, Opsgenie)

After setup, access the dashboard at **http://localhost:3000**.

## Setup Options

### Interactive wizard (recommended for first-time setup)

```bash
./scripts/setup.sh
```

Walks you through all configuration step by step.

### Non-interactive mode (for CI/CD and automation)

```bash
# Copy and fill in the template
cp setup-config.example.json setup-config.json

# Generate config files only
./scripts/setup.sh --config setup-config.json

# Generate config files and start containers
./scripts/setup.sh --config setup-config.json --start
```

See `setup-config.example.json` for the full schema.

### Migration from old metagraph-monitoring-service

If you have an existing `metagraph-monitoring-service` repository:

```bash
./scripts/migrate.sh /path/to/old-metagraph-monitoring-service
```

This will:
- Read your existing `config/config.json`
- Copy SSH keys and custom restart conditions
- Rewrite imports for compatibility
- Generate all new config files

You can also pass credentials non-interactively:

```bash
./scripts/migrate.sh /path/to/old-repo --auth admin:password123
```

### Migrating multiple metagraphs

Run `migrate.sh` once per old repo. Each run preserves previously migrated metagraphs:

```bash
./scripts/migrate.sh /path/to/metagraph-a --auth admin:pass
./scripts/migrate.sh /path/to/metagraph-b --auth admin:pass
```

The `envs/.env.shared` and `docker-compose.yml` are preserved/regenerated to include all metagraphs.

## Deployment

### Local

```bash
# Full deploy: install Docker + build + start
./scripts/deploy.sh

# Only install Docker
./scripts/deploy.sh --install

# Only build and start containers (Docker already installed)
./scripts/deploy.sh --start
```

### Remote (via SSH)

Deploy to a remote server using rsync + SSH:

```bash
# Full deploy on remote host
./scripts/deploy.sh --remote ubuntu@10.0.0.50

# Build + start only (Docker already installed on remote)
./scripts/deploy.sh --remote ubuntu@10.0.0.50 --start

# Custom SSH key
./scripts/deploy.sh --remote ubuntu@10.0.0.50 --key ~/.ssh/my_key --start
```

This transfers the project files via rsync and runs the deploy script on the remote host.

### Docker commands

```bash
docker compose up -d       # Start
docker compose down        # Stop
docker compose logs -f     # Follow logs
docker compose restart     # Restart
```

## Architecture

Each metagraph runs in its own Docker container. A gateway aggregates all metagraph APIs, and the UI runs in a separate container.

```
              ┌──────────────────────┐
              │     UI (Next.js)     │
              │      :3000           │
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐
              │      Gateway         │
              │      :3001           │
              └──────┬─────────┬─────┘
                     │         │
        ┌────────────┘         └────────────┐
        ▼                                   ▼
┌──────────────────────┐     ┌──────────────────────┐
│  monitor-metagraph-a │     │  monitor-metagraph-b │
│  (NestJS API :3001)  │     │  (NestJS API :3001)  │
│  Monitors + restarts │     │  Monitors + restarts │
└──────────────────────┘     └──────────────────────┘
```

## Configuration

### Config file

Each metagraph has a config file at `config/<name>.config.json`. Only essential fields are required -- everything else has sensible defaults:

**Required fields:**

| Field | Description |
|-------|-------------|
| `metagraph.id` | Metagraph DAG address |
| `metagraph.name` | Display name |
| `metagraph.layers` | ML0, CL1, DL1 layer ports. Set `ignore_layer: true` to disable a layer |
| `metagraph.nodes` | Node IPs, SSH usernames, key paths, P12 key files |
| `network.name` | `mainnet`, `integrationnet`, or `testnet` |
| `network.nodes` | Global L0 reference nodes (fetched automatically by setup) |

**Optional fields (with defaults):**

| Field | Default |
|-------|---------|
| `metagraph.version` | `"1.0.0"` |
| `metagraph.default_restart_conditions` | All 4 conditions enabled |
| `metagraph.default_alert_conditions` | All 2 conditions enabled |
| `check_healthy_interval_in_minutes` | `5` |
| `min_disk_space_percent` | `10` |
| `min_owner_wallet_balance` | `10` |

### Default restart conditions

- **SnapshotsStopped** - Metagraph stopped producing snapshots
- **UnhealthyNodes** - Nodes are in an unhealthy state
- **L0ForkedNodes** - L0 nodes have forked from the network
- **ForkedCluster** - The cluster has forked

### Default alert conditions

- **DiskSpaceLimit** - Disk space below threshold
- **OwnerWalletOutOfFunds** - Owner wallet balance below threshold

### Integrations (optional)

Each metagraph config can include an `integrations` block for notifications and cloud provider credentials:

```json
{
  "integrations": {
    "opsgenie_api_key": "your-opsgenie-key",
    "discord_webhook_url": "https://discord.com/api/webhooks/...",
    "aws": {
      "access_key_id": "AKIA...",
      "secret_access_key": "...",
      "region": "us-west-1"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `integrations.opsgenie_api_key` | Opsgenie API key for alerts |
| `integrations.discord_webhook_url` | Discord webhook for notifications |
| `integrations.aws.access_key_id` | AWS access key for instance reboot |
| `integrations.aws.secret_access_key` | AWS secret key |
| `integrations.aws.region` | AWS region (default: us-west-1) |

Each metagraph can have different integration credentials (e.g. one on AWS, another on Hetzner).

### Environment variables

Shared auth credentials live in `envs/.env.shared` (generated by setup/migrate):

| Variable | Description |
|----------|-------------|
| `AUTH_USERNAME` | Dashboard login username |
| `AUTH_PASSWORD` | Dashboard login password |
| `JWT_SECRET` | Auto-generated JWT signing key |
| `API_PORT` | API port (default: 3001) |
| `CORS_ORIGIN` | CORS origin (default: http://localhost:3000) |

## Custom Restart Conditions

Add custom restart logic by placing `.ts` files in the `custom-conditions/` directory. Each file should export a default class implementing `IRestartCondition`:

```typescript
import { MonitoringConfiguration } from '@core/MonitoringConfiguration';
import { IRestartCondition, ShouldRestartInfo } from '@core/interfaces';
import { FullMetagraph } from '@core/monitor/restart/groups';

export default class MyCondition implements IRestartCondition {
  name = 'MyCondition';

  constructor(private config: MonitoringConfiguration) {}

  async shouldRestart(): Promise<ShouldRestartInfo> {
    // Your logic here
    return { shouldRestart: false, restartType: '' };
  }

  async triggerRestart(): Promise<void> {
    const restart = new FullMetagraph(this.config);
    await restart.performRestart();
  }
}
```

See `custom-conditions/README.md` for available path aliases and the full interface definition.

## Multiple Metagraphs

Run the setup wizard multiple times or include multiple entries in `setup-config.json`. Each metagraph gets its own container and config file. The `docker-compose.yml` is regenerated to include all configured metagraphs.

## File Structure

```
.
├── config/                    # Metagraph config files (generated)
│   └── <name>.config.json
├── envs/                      # Environment files (generated)
│   └── .env.shared            # Auth, JWT, API settings
├── custom-conditions/         # Custom restart condition plugins
├── logs/                      # Log files per metagraph
├── scripts/
│   ├── setup.sh               # Interactive/non-interactive setup
│   ├── migrate.sh             # Migration from old repo
│   └── deploy.sh              # Docker deployment helper
├── src/
│   ├── core/                  # Monitoring engine
│   ├── server/                # NestJS API server
│   ├── gateway/               # API gateway
│   ├── shared/                # Shared types and DTOs
│   └── ui/                    # Next.js dashboard
├── docker-compose.yml         # Generated by setup/migrate
├── Dockerfile                 # Monitoring container
├── Dockerfile.gateway         # Gateway container
├── Dockerfile.ui              # Dashboard UI container
└── setup-config.example.json  # Template for non-interactive setup
```

## License

MIT
