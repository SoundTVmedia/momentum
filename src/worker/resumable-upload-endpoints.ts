import type { Context } from 'hono';
import { createStreamService } from './stream-service';
import { r2ForClipObjectKey } from './r2-clip-key';

interface ChunkMetadata {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
}

// Store chunk metadata in memory (in production, use KV or Durable Objects)
const uploadMetadata = new Map<string, ChunkMetadata>();

export async function handleResumableUpload(c: Context) {
  const formData = await c.req.formData();
  const chunk = formData.get('chunk') as File | null;
  const uploadId = formData.get('uploadId') as string | null;
  const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0');
  const totalChunks = parseInt(formData.get('totalChunks') as string || '1');
  const fileName = formData.get('fileName') as string || 'video.mp4';
  const fileSize = parseInt(formData.get('fileSize') as string || '0');

  if (!chunk || !uploadId) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  let metadata = uploadMetadata.get(uploadId);
  if (!metadata) {
    metadata = {
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: new Set(),
    };
    uploadMetadata.set(uploadId, metadata);
  }

  try {
    const chunkKey = `uploads/temp/${uploadId}/chunk_${chunkIndex}`;
    await c.env.R2_BUCKET.put(chunkKey, chunk.stream());

    metadata.uploadedChunks.add(chunkIndex);

    if (metadata.uploadedChunks.size === totalChunks) {
      const chunks: ArrayBuffer[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const tempKey = `uploads/temp/${uploadId}/chunk_${i}`;
        const chunkObject = await c.env.R2_BUCKET.get(tempKey);

        if (!chunkObject) {
          throw new Error(`Missing chunk ${i}`);
        }

        chunks.push(await chunkObject.arrayBuffer());
      }

      const combinedBlob = new Blob(chunks, { type: 'video/mp4' });
      const mochaUser = c.get('user');
      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

      for (let i = 0; i < totalChunks; i++) {
        const tempKey = `uploads/temp/${uploadId}/chunk_${i}`;
        await c.env.R2_BUCKET.delete(tempKey);
      }
      uploadMetadata.delete(uploadId);

      try {
        const streamService = createStreamService(c.env);
        const file = new File([combinedBlob], sanitizedName, {
          type: combinedBlob.type || 'video/mp4',
        });
        const videoDetails = await streamService.uploadVideo(file, { name: fileName });

        return c.json({
          success: true,
          streamVideoId: videoDetails.uid,
          playbackUrl: videoDetails.playbackUrl,
          mp4PlaybackUrl: videoDetails.mp4Url,
          thumbnailUrl: videoDetails.thumbnail,
          status: videoDetails.status,
          readyToStream: videoDetails.readyToStream,
          duration: videoDetails.duration,
          type: 'stream',
        }, 201);
      } catch (streamError) {
        console.error('Resumable Stream upload failed, falling back to R2:', streamError);
      }

      const finalKey = `clips/${mochaUser?.id || 'anonymous'}/video/${timestamp}_${sanitizedName}`;
      const r2 = r2ForClipObjectKey(c.env, finalKey);
      await r2.put(finalKey, combinedBlob.stream(), {
        httpMetadata: {
          contentType: 'video/mp4',
        },
      });

      const publicUrl = `/api/files/${encodeURIComponent(finalKey)}`;

      return c.json({
        success: true,
        url: publicUrl,
        key: finalKey,
        size: fileSize,
        type: 'video/mp4',
      }, 201);
    }

    return c.json({
      success: true,
      chunkIndex,
      uploadedChunks: metadata.uploadedChunks.size,
      totalChunks,
      complete: false,
    });
  } catch (error) {
    console.error('Resumable upload error:', error);
    return c.json({ error: 'Failed to process chunk' }, 500);
  }
}
