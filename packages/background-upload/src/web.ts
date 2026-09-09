import { WebPlugin } from '@capacitor/core';
import type {
  BackgroundUploadPlugin,
  ReachabilityStatus,
} from './definitions';

const QUEUE_KEY = 'feedback.background-upload.queue.v1';

function browserReachability(): ReachabilityStatus {
  const connected = typeof navigator === 'undefined' ? true : navigator.onLine;
  return { connected, expensive: false };
}

export class BackgroundUploadWeb extends WebPlugin implements BackgroundUploadPlugin {
  private listening = false;

  private ensureBrowserListeners(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    const emit = () => {
      void this.notifyListeners('reachabilityChange', browserReachability());
    };
    window.addEventListener('online', emit);
    window.addEventListener('offline', emit);
  }

  async getReachability(): Promise<ReachabilityStatus> {
    this.ensureBrowserListeners();
    return browserReachability();
  }

  async persistQueue(options: { jobsJson: string }): Promise<void> {
    try {
      localStorage.setItem(QUEUE_KEY, options.jobsJson);
    } catch {
      /* quota / private mode */
    }
  }

  async loadQueue(): Promise<{ jobsJson: string }> {
    try {
      return { jobsJson: localStorage.getItem(QUEUE_KEY) ?? '[]' };
    } catch {
      return { jobsJson: '[]' };
    }
  }

  async persistVideoFile(): Promise<{ path: string }> {
    throw this.unavailable('Native outbox files are only available on iOS/Android.');
  }

  async fileExists(): Promise<{ exists: boolean; size: number }> {
    return { exists: false, size: 0 };
  }

  async uploadPart(): Promise<{ accepted: boolean }> {
    return { accepted: false };
  }
}
