
# Metagraph Monitoring Service Package
This repository hosts the Metagraph Monitoring Service package. This package is responsible for monitoring your metagraph and performing restarts as needed. More details are provided in the sections below.

## Dependencies

### NodeJS
* You should have NodeJS > 18 installed
* Check the [installation guide](https://nodejs.org/en/download/package-manager)

### Yarn
* You should have yarn installed
* Check the [installation guide](https://classic.yarnpkg.com/lang/en/docs/install)

### User with Password-less Sudo Privileges
* This application will need to perform several operations, such as creating/writing files and terminating processes. To ensure everything functions correctly, the specified user on the monitoring instance and the nodes must have password-less sudo privileges.
* The SSH Key needs to have access to the node
* Refer to  [this document](https://gcore.com/learning/how-to-disable-password-for-sudo-command/) to learn how to enable password-less sudo for a user. 

## Installation

After cloning the repository, ensure you fetch all the dependencies. Please make sure you are using Node.js version 18 or higher. To install the dependencies, simply run the following command:

`yarn` or `npm install`

This will download all the necessary dependencies and populate the `node_modules` folder.

## Configuration
To run this service, you must provide the necessary configuration in the file: `config/config.json`. This file contains the following fields:

*   **`metagraph.id`**: The unique identifier for your metagraph.
*   **`metagraph.name`**: The name of your metagraph.
*   **`metagraph.version`**: The version of your metagraph.
*   **`metagraph.default_restart_conditions`**: Specifies the conditions under which your metagraph should restart. These conditions are located in the directory: `src/jobs/restart/conditions`. 
    *   By default, there are two conditions:
        *   `SnapshotStopped`: Triggers if your metagraph stops producing snapshots.
        *   `UnhealthyNodes`: Triggers if your metagraph nodes become unhealthy.
*   **`metagraph.layers`**: Details about your metagraph layers. Options include:
    *   **`ignore_layer`**: Set to `true` to disable a layer such as `currency-l1` or `data-l1`.
    *   **`ports`**: Lists public, p2p, and cli ports.
    *   **`additional_env_variables`**: Additional environment variables needed upon restart. Format: `["TEST=MY_VARIABLE, TEST_2=MY_VARIABLE_2"]`.
    *   **`seedlist`**: Information about the layer seedlist. Example: `{ base_url: ":your_url", file_name: ":your_file_name"}`.
*   **`metagraph.nodes`**: Configuration for your metagraph nodes:  
    *   **`ip`**: IP address of the node.
    *   **`username`**: Username for SSH access to the node.
    *   **`privateKeyPath`**: Path to the private key for SSH, relative to the service's root directory. Example: `config/your_key_file.pem`.
    *   **`key_file`**: Details of your `.p12` key file used for node startup, including `name`, `alias`, and `password`.
*   **`network.name`**: The network your metagraph is part of, such as `integrationnet` or `mainnet`.  
*   **`network.nodes`**: Information about the GL0s nodes.  
*   **`check_healthy_interval_in_minutes`**: The interval, in minutes, at which the health check should run.

## Interfaces

We offer a suite of interfaces that allow you to customize the restart flow for your metagraph. These interfaces are located in `src/interfaces`. Below is an overview of the available interfaces and their default implementations:

*  **`IRestartCondition`**: Use this interface to add new restart conditions to your metagraph. We currently implement this interface with two conditions:
    *   **`SnapshotStopped`**: Activates if your metagraph stops producing snapshots.
    *   **`UnhealthyNodes`**: Activates if your metagraph nodes become unhealthy. 
       
*  **`IAlertService`**: This interface allows the addition of new alert services to your restart mechanism. By default, we offer two options:
    *   **`NoAlertsService`**: Use this if no external alert system is required.
    *   **`OpsgenieAlertService`**: An example service for alerting via Opsgenie.
     
*  **`IGlobalNetworkService`**: Interface for requesting data from the global network. The default implementation is `ConstellationGlobalNetworkService`.
    
*   **`IMetagraphService`**: Interface for requesting data from the metagraph. The default implementation is `ConstellationMetagraphService`.
    
*  **`ILoggerService`**: Select your logging system through this interface. We provide two default options:
    *   **`ConsoleLoggerService`**: Outputs logs directly to the console.
    *   **`FileLoggerService`**: Stores logs in files located in the `logs` directory, with logs rotating daily or every 20MB.
     
*   **`ISeedlist`**: Choose your seedlist provider with this interface. We offer two default options:
    *   **`NoSeedlistService`**: For scenarios where no seedlist is used.
    *   **`GithubSeedlistService`**: Retrieves seedlist information from a GitHub release.

*   **`ISshService`**: This interface is for choosing your SSH communication tool with the nodes. The default implementation uses the `ssh2` library in NodeJS, available in `Ssh2Service`.


## Customizing Services

You can customize services further by implementing several interfaces such as `IAlertService`, `ILoggerService`, `IGlobalNetworkService`, `IMetagraphService`, `ISeedlistService`, and `ISshService`. All these interfaces are available in the following import statement:

```
import {
  IAlertService,
  ILoggerService,
  IGlobalNetworkService,
  IMetagraphService,
  ISeedlistService,
  ISshService,
} from '@interfaces';
``` 

Once you implement your services, provide them to the constructor as shown below:
```
import MonitoringApp from 'src';
import { ILoggerService } from '@interfaces';

class MyCustomLoggerService implements ILoggerService {
  constructor() {}

  info(message: string, meta?: unknown): void {
    console.log(message, meta);
  }

  warn(message: string, meta?: unknown): void {
    console.log(message, meta);
  }

  error(message: string, meta?: unknown): void {
    console.error(message, meta);
  }
}

const myCustomLogger = new MyCustomLoggerService();
const monitoring = new MonitoringApp(
  ...,
  ...,
  ...,
  {
    logger: myCustomLogger,
  },
);
```

## Customizing Restart Conditions

You can also customize your restart conditions. Import and implement a custom restart interface as follows:
```
import { IRestartCondition } from '@interfaces';

class MyCustomRestartCondition implements IRestartCondition {
  name: string;
  config: MonitoringConfigs;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;
  shouldRestart(): Promise<ShouldRestartInfo>;
  triggerRestart(): Promise<void>;
}
const myCustomRestartCondition = new MyCustomRestartCondition();
const monitoring = new MonitoringApp(
  ...,
  ...,
  ...,
  ...,
  [myCustomRestartCondition],
);
```