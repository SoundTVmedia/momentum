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
  errors: unknown[];
  messages: unknown[];
}

/** Cloudflare's own view of the generated MP4 for a video. */
export type StreamDownloadState = {
  status: 'inprogress' | 'ready' | 'error';
  /** Cloudflare's customer-subdomain URL — prefer it over a constructed one. */
  url: string;
  percentComplete: number;
};

interface StreamDownloadsResponse {
  result?: {
    default?: { status?: string; url?: string; percentComplete?: number };
  };
  success: boolean;
  errors: unknown[];
}

/**
 * Cloudflare returns a customer-subdomain URL
 * (`customer-<code>.cloudflarestream.com/<uid>/downloads/default.mp4`).
 * Keep that rather than rebuilding it, and only fall back to the
 * account-agnostic host when the payload omits it.
 */
export function parseStreamDownloadState(
  raw: { status?: string; url?: string; percentComplete?: number } | undefined,
  videoId: string,
  deliveryOrigin: string,
): StreamDownloadState | null {
  if (!raw) return null;
  const status = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
  const pct = typeof raw.percentComplete === 'number' ? raw.percentComplete : 0;
  const url =
    typeof raw.url === 'string' && raw.url.trim()
      ? raw.url.trim()
      : `${deliveryOrigin}/${videoId}/downloads/default.mp4`;
  if (status === 'ready') return { status: 'ready', url, percentComplete: 100 };
  if (status === 'error') return { status: 'error', url, percentComplete: pct };
  return { status: 'inprogress', url, percentComplete: pct };
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
    const requestBody: Record<string, unknown> = {
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
   * Ask Cloudflare to generate the progressive MP4 for a video.
   *
   * Nothing serves `/downloads/default.mp4` until this is called — the URL is
   * a 404 before that. Generation is asynchronous, so the caller polls
   * {@link getDownloads} until the status is `ready`. The video must already be
   * ready to stream; calling earlier is rejected.
   */
  async enableDownloads(videoId: string): Promise<StreamDownloadState | null> {
    return this.downloadsRequest(videoId, 'POST');
  }

  /** Current state of the generated MP4, or null when none has been requested. */
  async getDownloads(videoId: string): Promise<StreamDownloadState | null> {
    return this.downloadsRequest(videoId, 'GET');
  }

  private async downloadsRequest(
    videoId: string,
    method: 'GET' | 'POST',
  ): Promise<StreamDownloadState | null> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}/downloads`,
      {
        method,
        headers: { Authorization: `Bearer ${this.apiToken}` },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stream downloads ${method} failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as StreamDownloadsResponse;
    if (!data.success) {
      throw new Error(`Stream downloads ${method} failed: ${JSON.stringify(data.errors)}`);
    }
    return parseStreamDownloadState(data.result?.default, videoId, this.deliveryOrigin());
  }

  /** Public Stream delivery host (account-agnostic). */
  private deliveryOrigin(): string {
    return 'https://videodelivery.net';
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
    const baseUrl = `${this.deliveryOrigin()}/${videoId}/thumbnails/thumbnail.jpg`;
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  getEmbedUrl(videoId: string): string {
    return `${this.deliveryOrigin()}/${videoId}/iframe`;
  }

  getPlaybackUrl(videoId: string): string {
    return `${this.deliveryOrigin()}/${videoId}/manifest/video.m3u8`;
  }

  /**
   * Format raw Stream API response into our internal format
   */
  private formatVideoDetails(rawData: StreamUploadResponse['result']): StreamVideoDetails {
    const hls = rawData.playback?.hls || this.getPlaybackUrl(rawData.uid);
    return {
      uid: rawData.uid,
      thumbnail: rawData.thumbnail || this.getThumbnailUrl(rawData.uid, { time: '1s', height: 720 }),
      playbackUrl: hls,
      hlsUrl: hls,
      // No mp4Url: the progressive download does not exist until
      // enableDownloads() has been called and Cloudflare reports it ready.
      dashUrl: rawData.playback?.dash || '',
      previewUrl: rawData.preview || '',
      readyToStream: rawData.ready_to_stream || false,
      duration: rawData.duration || 0,
      status: rawData.status?.state || 'processing',
    };
  }
}

/**
 * Both secrets must be set for ingest to run. Without them every clip stays on
 * R2 playback, which works but costs the adaptive bitrate ladder — so callers
 * check this and say so once instead of throwing on every clip in every cron.
 */
export function isStreamConfigured(env: Env): boolean {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_STREAM_API_TOKEN?.trim());
}

export function describeStreamConfig(env: Env): {
  configured: boolean;
  accountIdConfigured: boolean;
  apiTokenConfigured: boolean;
  hint: string | null;
} {
  const accountIdConfigured = Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim());
  const apiTokenConfigured = Boolean(env.CLOUDFLARE_STREAM_API_TOKEN?.trim());
  const configured = accountIdConfigured && apiTokenConfigured;
  return {
    configured,
    accountIdConfigured,
    apiTokenConfigured,
    hint: configured
      ? null
      : `Cloudflare Stream ingest is off: ${[
          accountIdConfigured ? null : 'CLOUDFLARE_ACCOUNT_ID',
          apiTokenConfigured ? null : 'CLOUDFLARE_STREAM_API_TOKEN',
        ]
          .filter(Boolean)
          .join(' and ')} not set on the Worker (wrangler secret put). Clips keep playing from R2.`,
  };
}

/**
 * Create a Stream service instance from environment variables
 */
export function createStreamService(env: Env): StreamService {
  if (!isStreamConfigured(env)) {
    throw new Error('Cloudflare Stream credentials not configured');
  }

  return new StreamService(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_STREAM_API_TOKEN);
}
