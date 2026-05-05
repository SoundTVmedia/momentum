import { Context } from 'hono';
import { createStreamService } from './stream-service';

/**
 * Upload video from URL to Cloudflare Stream
 */
export async function uploadFromUrl(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { video_url, name } = body;

  if (!video_url) {
    return c.json({ error: "video_url is required" }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(video_url);
  } catch {
    return c.json({ error: "video_url must be a valid URL" }, 400);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return c.json({ error: "video_url must use http or https" }, 400);
  }

  try {
    const streamService = createStreamService(c.env);
    const videoDetails = await streamService.uploadFromUrl(video_url, {
      name: name || 'Uploaded video'
    });

    return c.json({
      success: true,
      streamVideoId: videoDetails.uid,
      playbackUrl: videoDetails.playbackUrl,
      thumbnailUrl: videoDetails.thumbnail,
      status: videoDetails.status,
      readyToStream: videoDetails.readyToStream,
      duration: videoDetails.duration,
      type: 'stream',
    }, 201);
  } catch (error) {
    console.error('Stream upload from URL failed:', error);

    // Match file-upload behavior: if Stream ingestion fails, keep upload flow usable.
    return c.json({
      success: true,
      url: parsedUrl.toString(),
      type: 'direct',
      streamFallback: true,
    }, 201);
  }
}

/**
 * Get video processing status from Cloudflare Stream
 */
export async function getVideoStatus(c: Context) {
  const videoId = c.req.param('videoId');

  if (!videoId) {
    return c.json({ error: "videoId is required" }, 400);
  }

  try {
    const streamService = createStreamService(c.env);
    const videoDetails = await streamService.getVideoDetails(videoId);

    if (!videoDetails) {
      return c.json({ error: "Video not found" }, 404);
    }

    return c.json({
      streamVideoId: videoDetails.uid,
      playbackUrl: videoDetails.playbackUrl,
      thumbnailUrl: videoDetails.thumbnail,
      status: videoDetails.status,
      readyToStream: videoDetails.readyToStream,
      duration: videoDetails.duration,
    });
  } catch (error) {
    console.error('Failed to get video status:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to get video status" 
    }, 500);
  }
}

/**
 * Delete video from Cloudflare Stream
 */
export async function deleteVideo(c: Context) {
  const mochaUser = c.get("user");
  
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const videoId = c.req.param('videoId');

  if (!videoId) {
    return c.json({ error: "videoId is required" }, 400);
  }

  try {
    const streamService = createStreamService(c.env);
    const success = await streamService.deleteVideo(videoId);

    if (success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to delete video" }, 500);
    }
  } catch (error) {
    console.error('Failed to delete video:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to delete video" 
    }, 500);
  }
}

/**
 * Get custom thumbnail URL for a video at specific timestamp
 */
export async function getThumbnail(c: Context) {
  const videoId = c.req.param('videoId');
  const time = c.req.query('time') || '0s';
  const width = parseInt(c.req.query('width') || '0');
  const height = parseInt(c.req.query('height') || '0');

  if (!videoId) {
    return c.json({ error: "videoId is required" }, 400);
  }

  try {
    const streamService = createStreamService(c.env);
    const thumbnailUrl = streamService.getThumbnailUrl(videoId, {
      time,
      width: width > 0 ? width : undefined,
      height: height > 0 ? height : undefined,
    });

    return c.json({ thumbnailUrl });
  } catch (error) {
    console.error('Failed to get thumbnail URL:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : "Failed to get thumbnail URL" 
    }, 500);
  }
}
