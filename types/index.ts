// Printer Job Types
export interface PrinterJob {
  AutoID: number;
  StationID: number;
  JobStatus: number;
  ReferenceNumber: string;
  Content: string;
  PrinterName: string;
  AddDateTime: string;
  ProcessDateTime: string | null;
  ExternalNotes: string;
}

export interface PrinterJobResponse {
  success: boolean;
  message: string;
  data: PrinterJob[];
}

// Service Types
export interface ServiceStatus {
  isRunning: boolean;
  startedAt: string | null;
  lastPollTime: string | null;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  lastError: string | null;
}

export interface ServiceConfig {
  apiUrl: string;
  pollInterval: number; // milliseconds
  printerIp: string;
  printerPort: number;
}

// Log Types
export enum LogLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

// Printer Types
export interface PrinterConfig {
  ip: string;
  port: number;
  type: 'network';
  characterSet: string;
  width: number;
}

export interface PrintResult {
  success: boolean;
  jobId: number;
  error?: string;
}
