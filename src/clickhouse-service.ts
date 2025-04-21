import { createClient } from '@clickhouse/client';
import config from './config';
import {
  JobData,
  RealtimeScanPayload,
  OtherScanPayload,
  ResourceStatsTable,
  DiskStatsTable,
  NetworkStatsTable,
  GPUStatsTable,
  ServicesTable,
  ServiceGPUUsageTable,
  SoftwareTable,
  ScanPayload
} from './types';

export class ClickHouseService {
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient({
      url: `http://${config.clickhouse.host}:${config.clickhouse.port}`,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: config.clickhouse.database,
    });
  }

  async processJob(jobData: JobData): Promise<void> {
    try {
      if (!jobData.jobData) {
        throw new Error('Invalid job data structure: missing jobData field');
      }
      
      const { tenant, payload } = jobData.jobData;
      const { tenant_id, host_id } = tenant;
      const timestamp = payload.timestamp;
      const scanType = payload.metadata.scanType;

      // Handle each scan type
      if (scanType === 'realtime') {
        await this.processRealtimeScan(tenant_id, host_id, payload as RealtimeScanPayload);
      } else if (scanType === 'other') {
        await this.processOtherScan(tenant_id, host_id, payload as OtherScanPayload);
      } else {
        console.warn(`Unknown scan type: ${scanType}, skipping processing`);
      }
    } catch (error) {
      console.error('Error processing job:', error);
      throw error;
    }
  }

  private static toClickhouseDateTime(ts: string): string {
    // ClickHouse DateTime expects 'YYYY-MM-DD HH:MM:SS' (no fractional, no timezone)
    // Remove timezone and fractional seconds
    // Example input: '2025-04-21T08:38:47.727181+01:00'
    // Output: '2025-04-21 08:38:47'
    if (!ts) return '';
    const match = ts.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    // fallback: try to parse as Date
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0,19).replace('T',' ');
    }
    return ts;
  }

  private async processRealtimeScan(tenantId: string, hostId: string, payload: RealtimeScanPayload): Promise<void> {
    const timestamp = ClickHouseService.toClickhouseDateTime(payload.timestamp);
    
    // Process resource_stats if available
    if (payload.resource_stats) {
      // Insert main resource stats
      const resourceStats: ResourceStatsTable = {
        tenant_id: tenantId,
        host_id: hostId,
        timestamp,
        cpu_usage: payload.resource_stats.cpu_usage || 0,
        cpu_temperature: payload.resource_stats.cpu_temperature || 0,
        memory_usage: payload.resource_stats.memory_usage || 0,
        memory_total: payload.resource_stats.memory_total || 0,
        memory_swap_used: payload.resource_stats.memory_swap_used || 0,
        memory_swap_total: payload.resource_stats.memory_swap_total || 0,
        scan_type: 'realtime',
        hostname: payload.network_info?.hostname || '',
      };
      await this.insertData('resource_stats', [resourceStats]);

      // Process disk stats if available
      if (payload.resource_stats.disks && payload.resource_stats.disks.length > 0) {
        const diskStats: DiskStatsTable[] = payload.resource_stats.disks.map(disk => ({
          tenant_id: tenantId,
          host_id: hostId,
          timestamp,
          name: disk.name || '',
          mount_point: disk.mount_point || '',
          file_system: disk.file_system || '',
          total_space: disk.total_space,
          used_space: disk.used_space,
          free_space: disk.free_space,
        }));
        await this.insertData('disk_stats', diskStats);
      }

      // Process network stats if available
      if (payload.resource_stats.network_stats && payload.resource_stats.network_stats.length > 0) {
        const networkStats: NetworkStatsTable[] = payload.resource_stats.network_stats.map(ns => ({
          tenant_id: tenantId,
          host_id: hostId,
          timestamp,
          interface_name: ns.interface_name,
          bytes_received: ns.bytes_received,
          bytes_sent: ns.bytes_sent,
          packets_received: ns.packets_received,
          packets_sent: ns.packets_sent,
          interface_timestamp: ClickHouseService.toClickhouseDateTime(ns.timestamp),
        }));
        await this.insertData('network_stats', networkStats);
      }
    }

    // Process GPU stats if available
    if (payload.gpu_stats && payload.gpu_stats.length > 0) {
      const gpuStats: GPUStatsTable[] = payload.gpu_stats.map(gpu => ({
        tenant_id: tenantId,
        host_id: hostId,
        timestamp,
        name: gpu.name,
        cpu_usage: gpu.cpu_usage,
        temperature: gpu.temperature || 0,
        memory_usage: gpu.memory_usage,
        memory_total: gpu.memory_total,
      }));
      await this.insertData('gpu_stats', gpuStats);
    }

    // Network info is already included in resource_stats
  }

  private async processOtherScan(tenantId: string, hostId: string, payload: OtherScanPayload): Promise<void> {
    const timestamp = ClickHouseService.toClickhouseDateTime(payload.timestamp);
    
    // Process services if available
    if (payload.services && payload.services.length > 0) {
      // Process main service data
      const services: ServicesTable[] = payload.services.map(service => ({
        tenant_id: tenantId,
        host_id: hostId,
        timestamp,
        name: service.name,
        status: service.status,
        enabled: service.enabled ? 1 : 0,
        cpu_usage: service.cpu_usage,
        memory_usage: service.memory_usage,
      }));
      await this.insertData('services', services);

      // Process service GPU usage if available
      const serviceGpuUsages: ServiceGPUUsageTable[] = [];
      payload.services.forEach(service => {
        if (service.gpu_usage && service.gpu_usage.length > 0) {
          service.gpu_usage.forEach(gpu => {
            serviceGpuUsages.push({
              tenant_id: tenantId,
              host_id: hostId,
              timestamp,
              service_name: service.name,
              gpu_name: gpu.name,
              cpu_usage: gpu.cpu_usage,
              memory_usage: gpu.memory_usage,
            });
          });
        }
      });
      
      if (serviceGpuUsages.length > 0) {
        await this.insertData('service_gpu_usage', serviceGpuUsages);
      }
    }

    // Process software if available
    if (payload.software && payload.software.length > 0) {
      const software: SoftwareTable[] = payload.software.map(sw => ({
        tenant_id: tenantId,
        host_id: hostId,
        timestamp,
        name: sw.name,
        version: sw.version,
      }));
      await this.insertData('software', software);
    }
  }

  private async insertData(table: string, data: any[]): Promise<void> {
    if (!data || data.length === 0) return;

    try {
      // Print a sample of what we're inserting
      console.log(`Inserting ${data.length} records into ${table}. Sample:`, 
        JSON.stringify(data[0]).substring(0, 300) + (JSON.stringify(data[0]).length > 300 ? '...' : ''));
      
      await this.client.insert({
        table,
        values: data,
        format: 'JSONEachRow',
      });
      
      console.log(`Successfully inserted ${data.length} records into ${table}`);
    } catch (error) {
      console.error(`Error inserting data into ${table}:`, error);
      
      // Type-safe error handling
      if (error instanceof Error) {
        console.error(`Error type: ${error.name}, Message: ${error.message}`);
        
        // Try fallback method with smaller batches if needed
        if (data.length > 1) {
          console.log(`Attempting fallback with smaller batches for ${table}...`);
          
          // Break the data into smaller chunks and try again
          const chunkSize = Math.max(1, Math.floor(data.length / 2));
          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            try {
              await this.client.insert({
                table,
                values: chunk,
                format: 'JSONEachRow',
              });
              console.log(`Successfully inserted chunk of ${chunk.length} records into ${table}`);
            } catch (chunkError) {
              console.error(`Fallback insert failed for chunk in ${table}:`, chunkError);
            }
          }
        }
      }
      
      // Re-throw the error to be handled by the calling function
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export default new ClickHouseService();
