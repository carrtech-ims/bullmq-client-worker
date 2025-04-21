import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import config from './config';
import clickHouseService from './clickhouse-service';
import { JobData, ScanPayload, Tenant } from './types';

// Create Redis connection
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Stats for processed jobs
let processedJobCount = 0;
let totalProcessingTimeMs = 0;
let intervalJobCount = 0;
let intervalProcessingTimeMs = 0;

const LOG_EVERY = config.worker?.logEvery || 100;

// Create worker
const worker = new Worker(
  config.queue.name,
  async (job: Job) => {
    try {
      // console.log(`Processing job ${job.id}`);
      
      // Get job data and extract the parts we need
      const data = job.data as any;
      
      // Normalize the data structure to a uniform format
      let tenant: Tenant;
      let payload: ScanPayload;
      
      // Check job format
      if (data.jobData?.tenant && data.jobData?.payload) {
        // Our defined format
        tenant = data.jobData.tenant;
        payload = data.jobData.payload;
      } else {
        // console.log(`Job ${job.id} has a non-standard format. Attempting to adapt...`);
        
        // Try to infer the structure based on the available data
        if (data.jobData?.payload?.metadata?.scanType) {
          // Format with payload inside jobData, but tenant info is missing
          payload = data.jobData.payload;
          tenant = {
            tenant_id: data.jobData.tenant?.tenant_id || "default-tenant",
            host_id: data.jobData.tenant?.host_id || "unknown-host"
          };
        } else if (data.payload?.metadata?.scanType) {
          // Format with payload at root level
          payload = data.payload;
          tenant = {
            tenant_id: data.tenant?.tenant_id || "default-tenant",
            host_id: data.tenant?.host_id || "unknown-host"
          };
        } else {
          // As a last resort, check if the entire object is the jobData structure
          if (data.tenant?.tenant_id && data.payload?.metadata?.scanType) {
            tenant = data.tenant;
            payload = data.payload;
          } else {
            console.error(`Could not determine job format for job ${job.id}:`, 
              JSON.stringify(data).substring(0, 200) + "...");
            throw new Error('Unrecognized job data structure');
          }
        }
      }
      
      // Extract scan type for logging
      const scanType = payload.metadata?.scanType || 'unknown';
      // console.log(`Processing ${scanType} scan job ${job.id} for tenant ${tenant.tenant_id}`);

      const start = Date.now();
      // Process the job with our standardized format
      await clickHouseService.processJob({ jobData: { tenant, payload } });
      
      const end = Date.now();
      const duration = end - start;
      processedJobCount++;
      totalProcessingTimeMs += duration;
      intervalJobCount++;
      intervalProcessingTimeMs += duration;
      if (intervalJobCount % LOG_EVERY === 0) {
        const intervalAvg = (intervalProcessingTimeMs / intervalJobCount).toFixed(2);
        const totalAvg = (totalProcessingTimeMs / processedJobCount).toFixed(2);
        console.log(`${processedJobCount} jobs processed (total avg: ${totalAvg} ms, last ${intervalJobCount} avg: ${intervalAvg} ms)`);
        intervalJobCount = 0;
        intervalProcessingTimeMs = 0;
      }
      
      // console.log(`Job ${job.id} processed successfully`);
      return { success: true, scanType };
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  },
  { 
    connection,
    concurrency: 10, // Process more jobs concurrently for better throughput
    removeOnComplete: { 
      count: 1000,  // Keep the last 1000 completed jobs
      age: 24 * 3600 // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      count: 5000 // Keep the last 5000 failed jobs
    }
  }
);

// Handle worker events
worker.on('completed', (job: Job) => {
  // Keep this minimal to reduce log volume in production
  // console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`Job ${job?.id || 'unknown'} failed:`, error.message);
});

worker.on('error', (error: Error) => {
  console.error('Worker error:', error.message);
});

// Handle process termination gracefully
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal, shutting down worker...');
  await worker.close();
  await connection.quit();
  await clickHouseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT signal, shutting down worker...');
  await worker.close();
  await connection.quit();
  await clickHouseService.close();
  process.exit(0);
});

console.log(`Worker started for queue: ${config.queue.name}`);
