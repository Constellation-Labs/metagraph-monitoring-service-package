# Custom Restart Conditions

Place `.ts` or `.js` files in this directory to add custom restart conditions to the metagraph monitoring service.

## How it works

Each file should export a **default class** that implements the `IRestartCondition` interface. The class constructor receives a `MonitoringConfiguration` instance.

Files are auto-discovered and loaded when the monitoring service starts.

## Example

```typescript
import { MonitoringConfiguration } from '@core/MonitoringConfiguration';
import {
  IRestartCondition,
  ShouldRestartInfo,
} from '@core/interfaces';
import { FullMetagraph } from '@core/monitor/restart/groups';

export default class MyCustomCondition implements IRestartCondition {
  name = 'MyCustomCondition';

  constructor(private config: MonitoringConfiguration) {}

  async shouldRestart(): Promise<ShouldRestartInfo> {
    // Your custom logic here
    return { shouldRestart: false, restartType: '' };
  }

  async triggerRestart(): Promise<void> {
    const restart = new FullMetagraph(this.config);
    await restart.performRestart();
  }
}
```

## Available path aliases

| Alias | Maps to |
|-------|---------|
| `@core/*` | `src/core/*` |
| `@interfaces/*` | `src/core/interfaces/*` |
| `@services/*` | `src/core/services/*` |
| `@utils/*` | `src/core/utils/*` |
| `@shared/*` | `src/core/shared/*` |

## Interface

```typescript
interface IRestartCondition {
  name: string;
  shouldRestart(): Promise<ShouldRestartInfo>;
  triggerRestart(): Promise<void>;
}

type ShouldRestartInfo = {
  shouldRestart: boolean;
  restartType: string;
  lastMetagraphSnapshotOrdinal?: number;
};
```
