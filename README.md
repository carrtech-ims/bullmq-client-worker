# Client BullMQ Worker

This worker processes client metrics sent through a Redis queue and stores them in ClickHouse.

## Overview

The application is designed to process two types of scan jobs:

1. **Realtime Scans** - Contains resource metrics, GPU stats, disk metrics, and network information.
2. **Other Scans** - Contains service information, software inventory, and any service GPU usage.

## Setup

1. Copy `.env.example` to `.env` and configure your Redis and ClickHouse connection details.

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
QUEUE_NAME=client-stats
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=stats
```

2. Install dependencies:

```bash
npm install
```

3. Build the application:

```bash
npm run build
```

4. Start the worker:

```bash
npm start
```

## Job Structure

The expected job format is:

```typescript
{
  jobData: {
    tenant: { 
      tenant_id: string; // UUID
      host_id: string;   // UUID
    };
    payload: {
      timestamp: string;  // ISO date string
      metadata: {
        scanType: string; // "realtime" or "other"
      };
      // Additional payload fields based on scan type
    };
  }
}
```

## Testing

You can publish example jobs to test the worker:

```bash
npm run publish-examples
```

## Development

For development mode with auto-restart:

```bash
npm run dev
```

## ClickHouse Tables

The worker stores data in the following tables:

- `resource_stats` - CPU and memory metrics
- `disk_stats` - Disk usage information
- `network_stats` - Network interface metrics
- `gpu_stats` - GPU metrics
- `services` - Running services information
- `service_gpu_usage` - GPU usage by services
- `software` - Installed software information

## License

ISC
