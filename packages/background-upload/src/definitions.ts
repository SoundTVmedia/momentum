import type { PluginListenerHandle } from '@capacitor/core';

export type ReachabilityStatus = {
  /** OS reports a usable (non-loopback) path. Captive / dead cell is still "connected" at this layer. */
  connected: boolean;
  expensive: boolean;
};

export type BackgroundUploadProgressEvent = {
  jobId: string;
  partNumber: number;
  sentBytes: number;
  totalBytes: number;
};

export type BackgroundUploadPartEvent = {
  jobId: string;
  partNumber: number;
  status: number;
  error?: string;
};

export interface BackgroundUploadPlugin {
  getReachability(): Promise<ReachabilityStatus>;
  persistQueue(options: { jobsJson: string }): Promise<void>;
  loadQueue(): Promise<{ jobsJson: string }>;
  persistVideoFile(options: {
    jobId: string;
    sourcePath?: string;
    fileName?: string;
  }): Promise<{ path: string }>;
  fileExists(options: { path: string }): Promise<{ exists: boolean; size: number }>;
  /** Schedule a background PUT of a byte range. Completion arrives via listeners. */
  uploadPart(options: {
    jobId: string;
    partNumber: number;
    url: string;
    filePath: string;
    offset: number;
    length: number;
    headers?: Record<string, string>;
    httpMethod?: string;
  }): Promise<{ accepted: boolean }>;
  addListener(
    eventName: 'reachabilityChange',
    listenerFunc: (event: ReachabilityStatus) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'uploadProgress',
    listenerFunc: (event: BackgroundUploadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'uploadPartComplete',
    listenerFunc: (event: BackgroundUploadPartEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'uploadPartFailed',
    listenerFunc: (event: BackgroundUploadPartEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
