import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as KeepAwake from 'expo-keep-awake';
import {
  completeUploadSession,
  initUploadSession,
  newIdempotencyKey,
  newJobId,
  pollUntilPublished,
  uploadVideoFileMultipart,
  type CaptureGeo,
  type OutboxJob,
  type UploadFormFields,
} from '@/src/lib/upload/multipart';

const META_KEY = 'feedback.rn.outbox.meta.v1';
const HANDOFF_KEY = 'feedback.rn.capture.handoff.v1';
export const CAPTURE_MAX_SECONDS = 60;

function captureDir(): string {
  const root = FileSystem.documentDirectory;
  if (!root) {
    throw new Error('Document directory unavailable on this device.');
  }
  return `${root}captures/`;
}

export type CaptureHandoff = {
  videoUri: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  recordingStartedAt: string;
  captureGeo: CaptureGeo;
  videoMetadata: OutboxJob['videoMetadata'];
  createdAt: number;
  /** JamBase / going-mark show match from the camera HUD. */
  showCandidate?: {
    jambase_event_id: string | null;
    jambase_artist_id: string | null;
    jambase_venue_id: string | null;
    artist_name: string | null;
    venue_name: string | null;
    location: string | null;
    event_title: string | null;
    startDate: string;
    distance_miles: number | null;
  } | null;
};

async function ensureCaptureDir(): Promise<void> {
  const dir = captureDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function persistCaptureFile(tempUri: string): Promise<{
  videoUri: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}> {
  await ensureCaptureDir();
  const stamp = Date.now();
  const fileName = `capture-${stamp}.mp4`;
  const dest = `${captureDir()}${fileName}`;
  const source = tempUri.startsWith('file://') ? tempUri : `file://${tempUri}`;
  await FileSystem.copyAsync({ from: source, to: dest });
  const info = await FileSystem.getInfoAsync(dest);
  const fileSize = info.exists && 'size' in info ? Number(info.size ?? 0) : 0;
  return {
    videoUri: dest,
    fileName,
    fileSize,
    contentType: 'video/mp4',
  };
}

function decodeBase64Prefix(b64: string): string {
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(b64.slice(0, 120_000));
    }
  } catch {
    /* ignore */
  }
  return b64;
}

/** Heuristic: scan file bytes for common audio atoms (mp4a/soun/aac). */
export async function assertVideoFileLikelyHasAudio(uri: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    length: 512_000,
    position: 0,
  });
  const decoded = decodeBase64Prefix(base64);
  const hasAtom = /mp4a|soun|aac |esds|alac|ac-3|ec-3/i.test(decoded);
  if (!hasAtom) {
    throw new Error(
      'This recording has no usable audio track. Please record again closer to the speakers.',
    );
  }
}

export async function writeCaptureHandoff(handoff: CaptureHandoff): Promise<void> {
  await AsyncStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
}

export async function readCaptureHandoff(): Promise<CaptureHandoff | null> {
  const raw = await AsyncStorage.getItem(HANDOFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CaptureHandoff;
  } catch {
    return null;
  }
}

export async function clearCaptureHandoff(): Promise<void> {
  await AsyncStorage.removeItem(HANDOFF_KEY);
}

async function readJobs(): Promise<OutboxJob[]> {
  const raw = await AsyncStorage.getItem(META_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OutboxJob[];
  } catch {
    return [];
  }
}

async function writeJobs(jobs: OutboxJob[]): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(jobs));
}

export async function listOutboxJobs(): Promise<OutboxJob[]> {
  const jobs = await readJobs();
  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function upsertOutboxJob(job: OutboxJob): Promise<void> {
  const jobs = await readJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) jobs[idx] = job;
  else jobs.unshift(job);
  await writeJobs(jobs);
}

export async function patchOutboxJob(
  id: string,
  patch: Partial<OutboxJob>,
): Promise<OutboxJob | null> {
  const jobs = await readJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  jobs[idx] = { ...jobs[idx], ...patch };
  await writeJobs(jobs);
  return jobs[idx];
}

export async function enqueueCaptureUpload(input: {
  handoff: CaptureHandoff;
  form: UploadFormFields;
}): Promise<OutboxJob> {
  const job: OutboxJob = {
    id: newJobId(),
    status: 'queued',
    error: null,
    progress: 0,
    createdAt: Date.now(),
    videoUri: input.handoff.videoUri,
    fileName: input.handoff.fileName,
    fileSize: input.handoff.fileSize,
    contentType: input.handoff.contentType,
    form: input.form,
    recordingAtIso: input.handoff.recordingStartedAt,
    captureGeo: input.handoff.captureGeo,
    videoMetadata: input.handoff.videoMetadata,
    sessionId: null,
    clipId: null,
    idempotencyKey: newIdempotencyKey(),
    gallerySaved: false,
    uploadRetryCount: 0,
  };
  await upsertOutboxJob(job);
  await clearCaptureHandoff();
  return job;
}

export async function saveCaptureToPhotos(videoUri: string): Promise<boolean> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return false;
    await MediaLibrary.saveToLibraryAsync(videoUri);
    return true;
  } catch {
    return false;
  }
}

export async function runOutboxJob(
  jobId: string,
  onUpdate?: (job: OutboxJob) => void,
): Promise<OutboxJob> {
  let job = (await listOutboxJobs()).find((j) => j.id === jobId);
  if (!job) throw new Error('Upload job not found');

  const emit = async (patch: Partial<OutboxJob>) => {
    const next = await patchOutboxJob(jobId, patch);
    if (next) {
      job = next;
      onUpdate?.(next);
    }
  };

  try {
    await KeepAwake.activateKeepAwakeAsync('upload-outbox');
    if (!job.gallerySaved) {
      const saved = await saveCaptureToPhotos(job.videoUri);
      await emit({ gallerySaved: saved });
    }

    await emit({ status: 'uploading', progress: 5, error: null });

    let sessionId = job.sessionId;
    let clipId = job.clipId;
    if (!sessionId) {
      const init = await initUploadSession(job);
      sessionId = init.sessionId;
      clipId = init.clipId;
      await emit({ sessionId, clipId });
    }

    await uploadVideoFileMultipart({
      sessionId,
      fileUri: job.videoUri,
      fileSize: job.fileSize,
      onProgress: (pct) => {
        void emit({ progress: Math.min(85, Math.max(5, pct)) });
      },
    });

    await emit({ status: 'completing', progress: 88 });
    await completeUploadSession(sessionId, job.idempotencyKey);
    await emit({ status: 'processing', progress: 92 });
    await pollUntilPublished(sessionId, (pct) => {
      void emit({ progress: pct });
    });
    await emit({ status: 'published', progress: 100, error: null });
    return (await listOutboxJobs()).find((j) => j.id === jobId)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    await emit({
      status: 'failed',
      error: message,
      uploadRetryCount: (job.uploadRetryCount ?? 0) + 1,
    });
    throw err;
  } finally {
    KeepAwake.deactivateKeepAwake('upload-outbox');
  }
}
