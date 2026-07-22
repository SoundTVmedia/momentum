import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import {
  prepareForVideoCapture,
  prepareRecordingSessionRecovery,
  restoreForMediaPlayback,
} from 'feedback-audio-session';
import { useAuth } from '@/src/lib/auth/AuthContext';
import { primeLocationOnUserGesture } from '@/src/lib/location';
import {
  fetchCameraVenues,
  fetchGoingMarksForCapture,
  goingAutoFillCandidate,
  previewFromCandidate,
  venueOptionKey,
  type CaptureShowPreview,
} from '@/src/lib/capture/show-match';
import {
  assertVideoFileLikelyHasAudio,
  CAPTURE_MAX_SECONDS,
  persistCaptureFile,
  writeCaptureHandoff,
  type CaptureHandoff,
} from '@/src/lib/upload/outbox';
import type { ClipShowCandidate } from '@shared/types';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function CaptureScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [isFocused, setIsFocused] = useState(true);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission: hasCam, requestPermission: requestCam } =
    useCameraPermission();
  const { hasPermission: hasMic, requestPermission: requestMic } =
    useMicrophonePermission();

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recordingStartedAt = useRef<string | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showPreview, setShowPreview] = useState<CaptureShowPreview>({
    status: 'idle',
    eventTitle: null,
    venueName: null,
    artistName: null,
    locationLine: null,
    notice: null,
  });
  const [pickerChoices, setPickerChoices] = useState<ClipShowCandidate[]>([]);
  const [selectedVenueKey, setSelectedVenueKey] = useState('');
  const showCandidateRef = useRef<ClipShowCandidate | null>(null);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hasCam) await requestCam();
        if (!hasMic) await requestMic();
        await prepareRecordingSessionRecovery();
        await prepareForVideoCapture();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Camera setup failed');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
      void restoreForMediaPlayback();
    };
  }, [hasCam, hasMic, requestCam, requestMic]);

  /** Match nearest JamBase / going show for the camera HUD. */
  useEffect(() => {
    if (!isFocused || !ready) return;
    let cancelled = false;

    (async () => {
      setShowPreview({
        status: 'loading',
        eventTitle: null,
        venueName: null,
        artistName: null,
        locationLine: null,
        notice: null,
      });
      setPickerChoices([]);
      showCandidateRef.current = null;
      setSelectedVenueKey('');

      if (!user) {
        setShowPreview({
          status: 'error',
          eventTitle: null,
          venueName: null,
          artistName: null,
          locationLine: null,
          notice: 'Sign in to match nearby shows on camera.',
        });
        return;
      }

      try {
        const loc = await primeLocationOnUserGesture();
        if (cancelled) return;
        if (!loc.granted || !loc.coords) {
          setShowPreview({
            status: 'error',
            eventTitle: null,
            venueName: null,
            artistName: null,
            locationLine: null,
            notice: 'Allow location to match venues near you.',
          });
          return;
        }

        const { latitude: lat, longitude: lon } = loc.coords;
        coordsRef.current = { lat, lon };

        const marks = await fetchGoingMarksForCapture();
        if (cancelled) return;
        const going = goingAutoFillCandidate(marks, lat, lon);
        if (going) {
          showCandidateRef.current = going;
          setSelectedVenueKey(venueOptionKey(going));
          setShowPreview(previewFromCandidate(going));
          return;
        }

        const { venues, notice } = await fetchCameraVenues({
          latitude: lat,
          longitude: lon,
        });
        if (cancelled) return;

        if (venues.length === 0) {
          setShowPreview({
            status: 'none',
            eventTitle: null,
            venueName: null,
            artistName: null,
            locationLine: null,
            notice: notice || 'No nearby shows matched yet.',
          });
          return;
        }

        if (venues.length === 1) {
          showCandidateRef.current = venues[0];
          setSelectedVenueKey(venueOptionKey(venues[0]));
          setShowPreview(previewFromCandidate(venues[0]));
          return;
        }

        showCandidateRef.current = venues[0];
        setSelectedVenueKey(venueOptionKey(venues[0]));
        setPickerChoices(venues.slice(0, 5));
        setShowPreview(previewFromCandidate(venues[0], 'picker'));
      } catch (err) {
        if (cancelled) return;
        setShowPreview({
          status: 'error',
          eventTitle: null,
          venueName: null,
          artistName: null,
          locationLine: null,
          notice:
            err instanceof Error
              ? err.message
              : 'Venue lookup failed. You can still record.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFocused, ready, user]);

  const clearTimers = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    stopTimer.current = null;
    tickTimer.current = null;
  };

  const finishRecording = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    clearTimers();
    try {
      await cameraRef.current.stopRecording();
    } catch {
      // may already be stopped
    }
  }, [busy]);

  const onRecordingFinished = useCallback(
    async (video: { path: string }) => {
      setRecording(false);
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 800));
        const persisted = await persistCaptureFile(video.path);
        if (persisted.fileSize < 1024) {
          throw new Error('Recording file was empty. Please try again.');
        }
        await assertVideoFileLikelyHasAudio(persisted.videoUri);

        let captureGeo: CaptureHandoff['captureGeo'] = null;
        const coords = coordsRef.current;
        if (coords) {
          captureGeo = {
            latitude: coords.lat,
            longitude: coords.lon,
            city: null,
            state: null,
            country: null,
          };
        } else {
          try {
            const loc = await primeLocationOnUserGesture();
            if (loc.coords) {
              captureGeo = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                city: null,
                state: null,
                country: null,
              };
            }
          } catch {
            /* geo optional */
          }
        }

        const handoff: CaptureHandoff = {
          ...persisted,
          recordingStartedAt: recordingStartedAt.current ?? new Date().toISOString(),
          captureGeo,
          videoMetadata: { recording_orientation: 'portrait' },
          createdAt: Date.now(),
          showCandidate: showCandidateRef.current,
        };
        await writeCaptureHandoff(handoff);
        await restoreForMediaPlayback();
        router.push('/upload');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save recording');
        await restoreForMediaPlayback();
      } finally {
        setBusy(false);
        setElapsed(0);
      }
    },
    [router],
  );

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recording || busy || !device) return;
    setError(null);
    setBusy(true);
    try {
      await prepareForVideoCapture();
      recordingStartedAt.current = new Date().toISOString();
      setElapsed(0);
      setRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        onRecordingFinished: (video) => {
          void onRecordingFinished(video);
        },
        onRecordingError: (err) => {
          setRecording(false);
          setBusy(false);
          setError(err.message || 'Recording failed');
          void restoreForMediaPlayback();
        },
      });

      tickTimer.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);

      stopTimer.current = setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        void finishRecording();
      }, CAPTURE_MAX_SECONDS * 1000);

      setBusy(false);
    } catch (err) {
      setRecording(false);
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start recording');
    }
  }, [busy, device, finishRecording, onRecordingFinished, recording]);

  if (!hasCam || !hasMic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Camera and microphone permission are required.</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            void requestCam();
            void requestMic();
          }}
        >
          <Text style={styles.buttonLabel}>Grant permissions</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {ready && isFocused ? (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused}
          video
          audio
          photo={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <ActivityIndicator color={colors.ember} />
        </View>
      )}

      <View style={styles.showCard}>
        {showPreview.status === 'loading' || showPreview.status === 'idle' ? (
          <View style={styles.showRow}>
            <ActivityIndicator color={colors.ember} size="small" />
            <Text style={styles.showHint}>
              Matching nearest JamBase show at your location…
            </Text>
          </View>
        ) : null}
        {(showPreview.status === 'ready' || showPreview.status === 'picker') && (
          <View style={styles.showBody}>
            {showPreview.eventTitle ? (
              <Text style={styles.showTitle} numberOfLines={2}>
                {showPreview.eventTitle}
              </Text>
            ) : showPreview.venueName ? (
              <Text style={styles.showTitle} numberOfLines={1}>
                {showPreview.venueName}
              </Text>
            ) : null}
            {showPreview.venueName &&
            showPreview.eventTitle &&
            !showPreview.eventTitle
              .toLowerCase()
              .includes(showPreview.venueName.toLowerCase()) ? (
              <Text style={styles.showMeta} numberOfLines={1}>
                {showPreview.venueName}
              </Text>
            ) : null}
            {showPreview.artistName ? (
              <Text style={styles.showArtist} numberOfLines={1}>
                {showPreview.artistName}
              </Text>
            ) : null}
            {showPreview.locationLine ? (
              <Text style={styles.showLocation} numberOfLines={1}>
                {showPreview.locationLine}
              </Text>
            ) : null}
            {showPreview.status === 'picker' && pickerChoices.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}
              >
                {pickerChoices.map((venue) => {
                  const key = venueOptionKey(venue);
                  const selected = selectedVenueKey === key;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.pickerChip, selected && styles.pickerChipActive]}
                      onPress={() => {
                        showCandidateRef.current = venue;
                        setSelectedVenueKey(key);
                        setShowPreview(previewFromCandidate(venue, 'picker'));
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerChipLabel,
                          selected && styles.pickerChipLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {venue.venue_name || venue.event_title || 'Venue'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        )}
        {(showPreview.status === 'none' || showPreview.status === 'error') &&
        showPreview.notice ? (
          <Text style={styles.showHint}>{showPreview.notice}</Text>
        ) : null}
      </View>

      <View style={styles.overlay}>
        <Text style={styles.timer}>
          {recording
            ? `${elapsed}s / ${CAPTURE_MAX_SECONDS}s`
            : `Tap to record (max ${CAPTURE_MAX_SECONDS}s)`}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.shutter, recording && styles.shutterActive]}
          disabled={busy}
          onPress={() => {
            if (recording) void finishRecording();
            else void startRecording();
          }}
        >
          <View style={[styles.shutterInner, recording && styles.shutterInnerActive]} />
        </Pressable>
        {busy ? <ActivityIndicator color={colors.ember} style={{ marginTop: 12 }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: colors.shellBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  body: { ...typography.body, textAlign: 'center' },
  button: {
    backgroundColor: colors.flare,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  buttonLabel: { color: colors.textBody, fontWeight: '700' },
  showCard: {
    position: 'absolute',
    top: 56,
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(3, 7, 18, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    padding: spacing.md,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  showBody: { gap: 4 },
  showTitle: {
    color: colors.textBody,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
  },
  showMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  showArtist: {
    color: colors.ember,
    fontSize: 12,
    fontWeight: '600',
  },
  showLocation: {
    color: colors.textMuted,
    fontSize: 11,
  },
  showHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  pickerRow: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    maxWidth: 160,
  },
  pickerChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.28)',
    borderColor: colors.glassBorderAccent,
  },
  pickerChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerChipLabelActive: {
    color: colors.textBody,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 48,
    alignItems: 'center',
    gap: spacing.sm,
  },
  timer: {
    color: colors.textBody,
    fontWeight: '600',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  shutterActive: { borderColor: colors.ember },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
  },
  shutterInnerActive: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.ember,
  },
});
