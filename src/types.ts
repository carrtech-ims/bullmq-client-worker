// Define the job payload types
export interface RealtimeScanPayload {
  timestamp: string; // ISO date string
  metadata: {
    scanType: string; // Will be "realtime"
  };
  resource_stats?: {
    cpu_usage: number;
    cpu_temperature?: number;
    memory_usage: number;
    memory_total: number;
    memory_swap_used?: number;
    memory_swap_total?: number;
    disks?: Array<{
      name: string;
      mount_point: string;
      file_system?: string;
      total_space: number;
      used_space: number;
      free_space: number;
    }>;
    network_stats?: Array<{
      interface_name: string;
      bytes_received: number;
      bytes_sent: number;
      packets_received: number;
      packets_sent: number;
      timestamp: string; // ISO date string
    }>;
  };
  gpu_stats?: Array<{
    name: string;
    cpu_usage: number;
    temperature?: number;
    memory_usage: number;
    memory_total: number;
  }>;
  network_info?: {
    hostname: string;
    ipv4?: string[];
    ipv6?: string[];
    dns?: string[];
  };
  notices?: Array<{
    subject: string;
    body: string;
  }>;
}

export interface OtherScanPayload {
  timestamp: string; // ISO date string
  metadata: {
    scanType: string; // Will be "other"
  };
  services?: Array<{
    name: string;
    status: "running" | "paused" | "stopped";
    enabled: boolean;
    cpu_usage: number;
    memory_usage: number;
    gpu_usage?: Array<{
      name: string;
      cpu_usage: number;
      memory_usage: number;
    }>;
  }>;
  software?: Array<{
    name: string;
    version: string;
  }>;
  notices?: Array<{
    subject: string;
    body: string;
  }>;
}

// Union type for the payload
export type ScanPayload = RealtimeScanPayload | OtherScanPayload;

// Tenant information
export interface Tenant {
  tenant_id: string;
  host_id: string;
}

// Format of the bullmq job data - now supporting multiple formats
export interface JobData {
  // Original format we defined
  jobData?: {
    tenant: Tenant;
    payload: ScanPayload;
  };
  // Alternative format seen in the wild
  returnValue?: any;
}

// Table schema types for ClickHouse tables
export interface ResourceStatsTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  cpu_usage: number;
  cpu_temperature: number;
  memory_usage: number;
  memory_total: number;
  memory_swap_used: number;
  memory_swap_total: number;
  scan_type: string;
  hostname: string;
}

export interface DiskStatsTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  name: string;
  mount_point: string;
  file_system: string;
  total_space: number;
  used_space: number;
  free_space: number;
}

export interface NetworkStatsTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  interface_name: string;
  bytes_received: number;
  bytes_sent: number;
  packets_received: number;
  packets_sent: number;
  interface_timestamp: string;
}

export interface GPUStatsTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  name: string;
  cpu_usage: number;
  temperature: number;
  memory_usage: number;
  memory_total: number;
}

export interface ServicesTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  name: string;
  status: string;
  enabled: number;
  cpu_usage: number;
  memory_usage: number;
}

export interface ServiceGPUUsageTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  service_name: string;
  gpu_name: string;
  cpu_usage: number;
  memory_usage: number;
}

export interface SoftwareTable {
  tenant_id: string;
  host_id: string;
  timestamp: string;
  name: string;
  version: string;
}
