import { BackgroundUpload } from '@feedback/background-upload';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNativeApp } from '@/react-app/lib/native-bridge';
import type { PersistedOutboxMeta } from './types';

function parseJobsJson(raw: string): PersistedOutboxMeta[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PersistedOutboxMeta[]) : [];
  } catch {
    return [];
  }
}

export async function persistNativeOutboxMeta(jobs: PersistedOutboxMeta[]): Promise<void> {
  try {
    await BackgroundUpload.persistQueue({ jobsJson: JSON.stringify(jobs) });
  } catch (err) {
    console.warn('persistNativeOutboxMeta:', err);
  }
}

export async function loadNativeOutboxMeta(): Promise<PersistedOutboxMeta[]> {
  try {
    const { jobsJson } = await BackgroundUpload.loadQueue();
    return parseJobsJson(jobsJson);
  } catch {
    return [];
  }
}

/**
 * Copy a capture file into Application Support / app files so the queue
 * survives app kill and device restart (Cache is not durable).
 */
export async function persistDurableVideoFile(options: {
  jobId: string;
  sourcePath?: string | null;
  fileName?: string;
}): Promise<string | null> {
  const sourcePath = options.sourcePath?.trim();
  if (!isNativeApp() && !sourcePath) return sourcePath ?? null;

  try {
    const result = await BackgroundUpload.persistVideoFile({
      jobId: options.jobId,
      sourcePath: sourcePath || undefined,
      fileName: options.fileName,
    });
    if (result.path?.trim()) return result.path.trim();
  } catch (err) {
    console.warn('persistDurableVideoFile plugin:', err);
  }

  if (!sourcePath || !Capacitor.isNativePlatform()) return sourcePath || null;

  try {
    const ext = (options.fileName ?? sourcePath).split('.').pop() || 'mp4';
    const destPath = `upload-outbox/${options.jobId}.${ext}`;
    await Filesystem.mkdir({
      path: 'upload-outbox',
      directory: Directory.Data,
      recursive: true,
    }).catch(() => undefined);
    await Filesystem.copy({
      from: sourcePath,
      to: destPath,
      toDirectory: Directory.Data,
    });
    const { uri } = await Filesystem.getUri({
      path: destPath,
      directory: Directory.Data,
    });
    return uri?.trim() || sourcePath;
  } catch (err) {
    console.warn('persistDurableVideoFile filesystem:', err);
    return sourcePath;
  }
}

export async function recoverDurableVideoPath(
  jobId: string,
  fileName?: string,
): Promise<string | null> {
  try {
    const result = await BackgroundUpload.persistVideoFile({
      jobId,
      fileName,
    });
    return result.path?.trim() || null;
  } catch {
    return null;
  }
}

export async function nativeOutboxFileExists(path: string | null | undefined): Promise<boolean> {
  const trimmed = path?.trim();
  if (!trimmed) return false;
  try {
    const info = await BackgroundUpload.fileExists({ path: trimmed });
    return Boolean(info.exists && info.size > 0);
  } catch {
    return false;
  }
}
