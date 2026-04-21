import type { Context } from 'hono';

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

  // Get or create metadata
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
    // Store chunk in R2
    const chunkKey = `uploads/temp/${uploadId}/chunk_${chunkIndex}`;
    await c.env.R2_BUCKET.put(chunkKey, chunk.stream());

    // Mark chunk as uploaded
    metadata.uploadedChunks.add(chunkIndex);

    // Check if all chunks are uploaded
    if (metadata.uploadedChunks.size === totalChunks) {
      // All chunks received, assemble the file
      const chunks: ArrayBuffer[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `uploads/temp/${uploadId}/chunk_${i}`;
        const chunkObject = await c.env.R2_BUCKET.get(chunkKey);
        
        if (!chunkObject) {
          throw new Error(`Missing chunk ${i}`);
        }
        
        chunks.push(await chunkObject.arrayBuffer());
      }

      // Combine chunks
      const combinedBlob = new Blob(chunks);
      
      // Upload combined file to final location
      const mochaUser = c.get('user');
      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const finalKey = `clips/${mochaUser?.id || 'anonymous'}/video/${timestamp}_${sanitizedName}`;

      await c.env.R2_BUCKET.put(finalKey, combinedBlob.stream(), {
        httpMetadata: {
          contentType: 'video/mp4',
        },
      });

      // Clean up chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `uploads/temp/${uploadId}/chunk_${i}`;
        await c.env.R2_BUCKET.delete(chunkKey);
      }

      // Clean up metadata
      uploadMetadata.delete(uploadId);

      // Return success with file URL
      const publicUrl = `/api/files/${encodeURIComponent(finalKey)}`;
      
      return c.json({
        success: true,
        url: publicUrl,
        key: finalKey,
        size: fileSize,
        type: 'video/mp4',
      }, 201);
    }

    // Not all chunks uploaded yet
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
