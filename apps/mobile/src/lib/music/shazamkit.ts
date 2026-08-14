import { Platform } from 'react-native';
import { getFeedbackShazamKitNativeModule } from 'feedback-shazamkit';
import {
  normalizeShazamKitMatch,
  type MusicRecognitionMatch,
} from '@/src/lib/music/recognition';

/**
 * True when the ShazamKit native module can run on this device:
 * iOS 15+ dev client / build that includes modules/feedback-shazamkit.
 * Android, web, and older dev clients return false (ACRCloud fallback).
 */
export function isShazamKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  const mod = getFeedbackShazamKitNativeModule();
  if (!mod) return false;
  try {
    return mod.isSupported();
  } catch {
    return false;
  }
}

/**
 * Recognize the song in a recorded local video/audio file via ShazamKit.
 * Resolves the normalized match, or null on a clean no-match. Throws on
 * unavailable platform, unreadable file, or a failed match attempt
 * (e.g. missing com.apple.developer.shazamkit entitlement).
 */
export async function recognizeSongFromVideo(
  fileUri: string,
): Promise<MusicRecognitionMatch | null> {
  const mod = Platform.OS === 'ios' ? getFeedbackShazamKitNativeModule() : null;
  if (!mod) {
    throw new Error('ShazamKit is not available on this device.');
  }
  const raw = await mod.recognizeFromFile(fileUri);
  return normalizeShazamKitMatch(raw);
}
