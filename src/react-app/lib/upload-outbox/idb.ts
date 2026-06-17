import type { PersistedOutboxMeta, StoredUploadBlobs } from './types';

const DB_NAME = 'momentum_upload_outbox';
const DB_VERSION = 1;
const META_KEY = 'jobs';

type MetaStore = { key: string; jobs: PersistedOutboxMeta[] };
type BlobRecord = { jobId: string } & StoredUploadBlobs;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'jobId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
}

export async function loadOutboxMeta(): Promise<PersistedOutboxMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const store = tx.objectStore('meta');
    const req = store.get(META_KEY);
    req.onsuccess = () => {
      const row = req.result as MetaStore | undefined;
      resolve(row?.jobs ?? []);
    };
    req.onerror = () => reject(req.error ?? new Error('loadOutboxMeta failed'));
  });
}

export async function saveOutboxMeta(jobs: PersistedOutboxMeta[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key: META_KEY, jobs });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('saveOutboxMeta failed'));
  });
}

export async function saveOutboxBlobs(jobId: string, blobs: StoredUploadBlobs): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    tx.objectStore('blobs').put({ jobId, ...blobs });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('saveOutboxBlobs failed'));
  });
}

export async function loadOutboxBlobs(jobId: string): Promise<StoredUploadBlobs | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly');
    const req = tx.objectStore('blobs').get(jobId);
    req.onsuccess = () => {
      const row = req.result as BlobRecord | undefined;
      if (!row?.video) {
        resolve(null);
        return;
      }
      resolve({ video: row.video, thumbnail: row.thumbnail ?? null });
    };
    req.onerror = () => reject(req.error ?? new Error('loadOutboxBlobs failed'));
  });
}

export async function deleteOutboxJob(jobId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['blobs', 'meta'], 'readwrite');
    tx.objectStore('blobs').delete(jobId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('deleteOutboxJob failed'));
  });
}
