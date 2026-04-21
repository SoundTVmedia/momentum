import { useState, useCallback } from 'react';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseResumableUploadResult {
  uploadFile: (file: File, onProgress?: (progress: UploadProgress) => void) => Promise<any>;
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  cancel: () => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for resumable uploads

export function useResumableUpload(): UseResumableUploadResult {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const uploadFile = useCallback(async (
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<any> => {
    setUploading(true);
    setError(null);
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // For files under 10MB, use direct upload (faster)
      if (file.size < 10 * 1024 * 1024) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'video');

        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progressData = {
                loaded: e.loaded,
                total: e.total,
                percentage: Math.round((e.loaded / e.total) * 100)
              };
              setProgress(progressData);
              onProgress?.(progressData);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
          });

          controller.signal.addEventListener('abort', () => {
            xhr.abort();
          });

          xhr.open('POST', '/api/upload');
          xhr.send(formData);
        });
      }

      // For larger files, use chunked resumable upload
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      let uploadedBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (controller.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('fileSize', file.size.toString());

        const response = await fetch('/api/upload/resumable', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chunk upload failed: ${response.statusText}`);
        }

        uploadedBytes += chunk.size;
        const progressData = {
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100)
        };
        setProgress(progressData);
        onProgress?.(progressData);

        // If this is the last chunk, return the result
        if (chunkIndex === totalChunks - 1) {
          return await response.json();
        }
      }

      throw new Error('Upload incomplete');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
      setAbortController(null);
    }
  }, []);

  const cancel = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  return {
    uploadFile,
    uploading,
    progress,
    error,
    cancel,
  };
}
