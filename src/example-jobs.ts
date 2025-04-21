import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import config from './config';
import { JobData, RealtimeScanPayload, OtherScanPayload } from './types';

// Create Redis connection
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
});

// Create queue
const queue = new Queue(config.queue.name, { connection });

// Example realtime scan payload
const realtimePayload: RealtimeScanPayload = {
  timestamp: new Date().toISOString(),
  metadata: {
    scanType: 'realtime',
  },
  resource_stats: {
    cpu_usage: 45.5,
    cpu_temperature: 65.3,
    memory_usage: 8589934592, // 8 GB
    memory_total: 17179869184, // 16 GB
    memory_swap_used: 1073741824, // 1 GB
    memory_swap_total: 4294967296, // 4 GB
    disks: [
      {
        name: 'sda1',
        mount_point: '/',
        file_system: 'ext4',
        total_space: 107374182400, // 100 GB
        used_space: 64424509440, // 60 GB
        free_space: 42949672960, // 40 GB
      },
    ],
    network_stats: [
      {
        interface_name: 'eth0',
        bytes_received: 1073741824, // 1 GB
        bytes_sent: 536870912, // 512 MB
        packets_received: 1000000,
        packets_sent: 500000,
        timestamp: new Date().toISOString(),
      },
    ],
  },
  gpu_stats: [
    {
      name: 'NVIDIA GeForce RTX 3080',
      cpu_usage: 75.2,
      temperature: 70.1,
      memory_usage: 8589934592, // 8 GB
      memory_total: 10737418240, // 10 GB
    },
  ],
  network_info: {
    hostname: 'server-01',
    ipv4: ['192.168.1.100'],
    ipv6: ['fe80::1234:5678:9abc:def0'],
    dns: ['8.8.8.8', '8.8.4.4'],
  },
};

// Example other scan payload
const otherPayload: OtherScanPayload = {
  timestamp: new Date().toISOString(),
  metadata: {
    scanType: 'other',
  },
  services: [
    {
      name: 'nginx',
      status: 'running',
      enabled: true,
      cpu_usage: 2.5,
      memory_usage: 268435456, // 256 MB
    },
    {
      name: 'postgresql',
      status: 'running',
      enabled: true,
      cpu_usage: 5.1,
      memory_usage: 536870912, // 512 MB
      gpu_usage: [
        {
          name: 'NVIDIA GeForce RTX 3080',
          cpu_usage: 10.5,
          memory_usage: 1073741824, // 1 GB
        },
      ],
    },
  ],
  software: [
    {
      name: 'nginx',
      version: '1.18.0',
    },
    {
      name: 'postgresql',
      version: '13.4',
    },
    {
      name: 'node',
      version: '16.13.0',
    },
  ],
};

// Job data for realtime scan
const realtimeJobData: JobData = {
  jobData: {
    tenant: {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      host_id: '550e8400-e29b-41d4-a716-446655440001',
    },
    payload: realtimePayload,
  },
};

// Job data for other scan
const otherJobData: JobData = {
  jobData: {
    tenant: {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      host_id: '550e8400-e29b-41d4-a716-446655440001',
    },
    payload: otherPayload,
  },
};

// Function to add jobs to the queue
async function addJobs() {
  try {
    console.log('Adding example jobs to the queue...');
    
    // Add realtime scan job
    const realtimeJob = await queue.add('realtime-scan', realtimeJobData);
    console.log(`Added realtime scan job with ID: ${realtimeJob.id}`);
    
    // Add other scan job
    const otherJob = await queue.add('other-scan', otherJobData);
    console.log(`Added other scan job with ID: ${otherJob.id}`);
    
    console.log('Jobs added successfully.');
  } catch (error) {
    console.error('Error adding jobs:', error);
  } finally {
    await connection.quit();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  addJobs().catch(console.error);
}
