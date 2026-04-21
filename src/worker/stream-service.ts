/**
 * Cloudflare Stream Video Processing Service
 * Handles video uploads, transcoding, and adaptive bitrate streaming
 */

interface StreamUploadResponse {
  result: {
    uid: string;
    thumbnail: string;
    playback: {
      hls: string;
      dash: string;
    };
    preview: string;
    ready_to_stream: boolean;
    status: {
      state: string;
      pct_complete: string;
    };
    meta: {
      name: string;
    };
    created: string;
    modified: string;
    size: number;
    duration: number;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

interface StreamVideoDetails {
  uid: string;
  thumbnail: string;
  playbackUrl: string;
  hlsUrl: string;
  dashUrl: string;
  previewUrl: string;
  readyToStream: boolean;
  duration: number;
  status: string;
}

export class StreamService {
  private accountId: string;
  private apiToken: string;

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }

  /**
   * Upload a video file to Cloudflare Stream
   */
  async uploadVideo(file: File, metadata?: { name?: string }): Promise<StreamVideoDetails> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (metadata?.name) {
      formData.append('meta', JSON.stringify({ name: metadata.name }));
    }

    // Set to require signed URLs for production, but allow public for development
    formData.append('requireSignedURLs', 'false');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stream upload failed: ${error}`);
    }

    const data: StreamUploadResponse = await response.json();

    if (!data.success) {
      throw new Error(`Stream upload failed: ${JSON.stringify(data.errors)}`);
    }

    return this.formatVideoDetails(data.result);
  }

  /**
   * Upload a video from a URL to Cloudflare Stream
   */
  async uploadFromUrl(url: string, metadata?: { name?: string }): Promise<StreamVideoDetails> {
    const requestBody: any = {
      url: url,
      meta: metadata?.name ? { name: metadata.name } : {},
      requireSignedURLs: false,
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stream URL upload failed: ${error}`);
    }

    const data: StreamUploadResponse = await response.json();

    if (!data.success) {
      throw new Error(`Stream URL upload failed: ${JSON.stringify(data.errors)}`);
    }

    return this.formatVideoDetails(data.result);
  }

  /**
   * Get video details and status from Stream
   */
  async getVideoDetails(videoId: string): Promise<StreamVideoDetails | null> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      throw new Error(`Failed to get video details: ${error}`);
    }

    const data: StreamUploadResponse = await response.json();

    if (!data.success) {
      throw new Error(`Failed to get video details: ${JSON.stringify(data.errors)}`);
    }

    return this.formatVideoDetails(data.result);
  }

  /**
   * Delete a video from Stream
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete video: ${error}`);
    }

    const data = await response.json() as { success: boolean };
    return data.success;
  }

  /**
   * Generate a thumbnail URL for a specific timestamp
   */
  getThumbnailUrl(videoId: string, options?: { time?: string; width?: number; height?: number }): string {
    const params = new URLSearchParams();
    
    if (options?.time) params.append('time', options.time);
    if (options?.width) params.append('width', options.width.toString());
    if (options?.height) params.append('height', options.height.toString());
    
    const queryString = params.toString();
    const baseUrl = `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`;
    
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  /**
   * Get the embed iframe URL for a video
   */
  getEmbedUrl(videoId: string): string {
    return `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/iframe`;
  }

  /**
   * Get direct playback URL
   */
  getPlaybackUrl(videoId: string): string {
    return `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
  }

  /**
   * Format raw Stream API response into our internal format
   */
  private formatVideoDetails(rawData: StreamUploadResponse['result']): StreamVideoDetails {
    return {
      uid: rawData.uid,
      thumbnail: rawData.thumbnail || this.getThumbnailUrl(rawData.uid),
      playbackUrl: rawData.playback?.hls || this.getPlaybackUrl(rawData.uid),
      hlsUrl: rawData.playback?.hls || this.getPlaybackUrl(rawData.uid),
      dashUrl: rawData.playback?.dash || '',
      previewUrl: rawData.preview || '',
      readyToStream: rawData.ready_to_stream || false,
      duration: rawData.duration || 0,
      status: rawData.status?.state || 'processing',
    };
  }
}

/**
 * Create a Stream service instance from environment variables
 */
export function createStreamService(env: Env): StreamService {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error('Cloudflare Stream credentials not configured');
  }

  return new StreamService(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_STREAM_API_TOKEN);
}
