import { AwsClient } from 'aws4fetch';
import { UPLOAD_PART_SIZE_BYTES } from '../shared/upload';

const PRESIGN_TTL_SECONDS = 3600;

export function r2PresignConfigured(env: Env): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.CLOUDFLARE_ACCOUNT_ID &&
      env.R2_BUCKET_NAME,
  );
}

function r2Endpoint(env: Env): string {
  return `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function awsClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  });
}

/** Presigned PUT URLs for each multipart part (direct client → R2). */
export async function presignMultipartPartUrls(
  env: Env,
  key: string,
  uploadId: string,
  totalParts: number,
): Promise<string[]> {
  const client = awsClient(env);
  const bucket = env.R2_BUCKET_NAME!;
  const base = `${r2Endpoint(env)}/${bucket}/${encodeR2Key(key)}`;

  const urls: string[] = [];
  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const url = new URL(base);
    url.searchParams.set('partNumber', String(partNumber));
    url.searchParams.set('uploadId', uploadId);
    url.searchParams.set('X-Amz-Expires', String(PRESIGN_TTL_SECONDS));
    const signed = await client.sign(new Request(url.toString(), { method: 'PUT' }), {
      aws: { signQuery: true },
    });
    urls.push(signed.url);
  }
  return urls;
}

function encodeR2Key(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function computeTotalParts(fileSize: number): number {
  return Math.max(1, Math.ceil(fileSize / UPLOAD_PART_SIZE_BYTES));
}

export { UPLOAD_PART_SIZE_BYTES };
