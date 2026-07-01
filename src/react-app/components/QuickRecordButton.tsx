import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Film, Loader2, Circle, Square, Images, RefreshCw, MapPin, Music, Camera } from 'lucide-react';
import CameraZoomControls from '@/react-app/components/CameraZoomControls';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import type { PrimedCaptureGeo } from '@/react-app/utils/primeGeolocationOnUserGesture';
import type { ClipShowCandidate } from '@/shared/types';
import { resolveClipEventTitle } from '@/shared/event-title';
import {
  identifyMusicWithAudD,
  auddSourceKey,
  auddPrefillFromLiveMatch,
} from '@/react-app/utils/auddIdentify';
import type { SongPrior } from '@/react-app/utils/liveSongStabilizer';
import { LiveSongStabilizer } from '@/react-app/utils/liveSongStabilizer';
import { isAppleMediaRecorderPlatform, pickAudioRecorderMime, pickVideoRecorderMime } from '@/react-app/utils/audioRecorderMime';
import {
  clipShowCandidateToNavState,
  clearCaptureShowSession,
  loadStickyCaptureShowSession,
  saveCaptureShowSession,
} from '@/react-app/utils/captureShowSession';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';
import { clipCandidateMatchesCameraCaptureDay, resolveCameraGoingAutoFill, isCameraGoingAutoFillSource } from '@/shared/clip-resolve-show-match';
import { readDeviceCoordsForNearbyShows } from '@/react-app/lib/nearby-shows-url';
import {
  animateCaptureZoom,
  applyCaptureZoom,
  buildCaptureZoomPresets,
  clampCameraZoom,
  decomposeCaptureZoom,
  captureZoomRange,
  readCameraZoomRange,
  readCurrentCameraZoom,
  touchPairDistance,
  zoomFromPinchScale,
  type CameraZoomRange,
} from '@/react-app/utils/cameraZoom';
import {
  cameraPreviewHasFrames,
  cameraPreviewLooksReady,
  deviceIsPortraitViewport,
  kickCameraPreviewPlay,
  prepareCameraPreviewElement,
  readCaptureDimensionsFromPreview,
} from '@/react-app/utils/cameraPreview';
import {
  capturePhotoFromStream,
  photoBlobToStillVideoBlob,
} from '@/react-app/utils/cameraPhotoCapture';
import {
  shouldUseNativeIosCapture,
  isNativeCapturePreviewRunning,
  startNativeCapturePreview,
  stopNativeCaptureSession,
  startNativeVideoRecording,
  stopNativeVideoRecording,
  setNativeCaptureZoom,
  flipNativeCamera,
  stopNativeLiveAudioSegments,
  readNativeZoomState,
  nativeVideoPathToBlob,
  nativeCaptureHaptic,
  nativeCaptureWarningHaptic,
  captureNativePhoto,
  NATIVE_CAPTURE_MAX_SECONDS,
} from '@/react-app/lib/native-capture';

/** Hard cap for in-app capture and gallery uploads (1 minute). */
const MAX_CLIP_LENGTH_SECONDS = 60;
const MAX_RECORDING_TIME = MAX_CLIP_LENGTH_SECONDS;
const HAPTIC_WARNING_TIME = 50;
/** Parallel mic track for song ID — runs with main recording (stopped when recording ends). */
/**
 * Live ID: one complete mic recording per segment (not MediaRecorder timeslices — those are
 * often invalid WebM fragments and ACR returns 2004).
 */
const LIVE_AUDD_SEGMENT_MS = 5_000;
/** After stop, wait briefly for the in-flight segment identify before caption screen. */
const LIVE_AUDD_STOP_WAIT_MS = 4_000;
/** ACRCloud often rejects tiny/incomplete WebM (2004); align with worker MIN_WEBM_BYTES. */
const MIN_LIVE_AUDD_CHUNK_BYTES = 4096;

interface QuickRecordButtonProps {
  isOpen?: boolean;
  onClose?: () => void;
  /**
   * Called after a successful recording or gallery pick navigates to `/upload` with clip state.
   * Use this to dismiss the parent capture overlay **without** mutating `history.state` (e.g. Upload page).
   * If omitted, `onClose` runs (e.g. MobileBottomNav stops primed streams and hides capture).
   */
  onAfterCaptureNavigate?: () => void;
  /** Obtained in the same user gesture as opening capture (see MobileBottomNav). Required for iOS Safari. */
  primedMediaStream?: MediaStream | null;
  /** When false, skip getUserMedia on open (primed stream or caller handles it). */
  autoRequestCamera?: boolean;
  /** Parent is resolving getUserMedia on the capture tap — wait before treating as gesture-only with no stream. */
  gestureCameraPrimingPending?: boolean;
  /** Parent starts geolocation in the same gesture as camera (Capture / Re-record tap). */
  captureLaunchGeo?: PrimedCaptureGeo | null;
  /** Set true when parent’s priming promise settled (even if geo is null). */
  captureLaunchGeoResolved?: boolean;
  /** When true, do not call getUserMedia until launch-time geolocation has finished (location before camera/mic). */
  deferCameraUntilLaunchGeo?: boolean;
  /** Optional setlist / venue / time priors for live on-screen song ID (see `LiveSongStabilizer`). */
  liveSongPriors?: SongPrior[];
}

export default function QuickRecordButton({
  isOpen = false,
  onClose,
  primedMediaStream = null,
  autoRequestCamera = true,
  gestureCameraPrimingPending = false,
  captureLaunchGeo,
  /** When `deferCameraUntilLaunchGeo`, parent must set `true` after launch-time GPS finishes (even if coords are null). */
  captureLaunchGeoResolved = false,
  deferCameraUntilLaunchGeo = false,
  onAfterCaptureNavigate,
  /** Optional setlist / venue / time-window hints — reduces confirmation streak when AudD agrees. */
  liveSongPriors,
}: QuickRecordButtonProps = {}) {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { activeCount: clipUploadsInFlight } = useClipUploadQueue();
  const { captureMarks, hydrated: showMarksHydrated } = useShowMarks();
  const lastGeoRef = useRef<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null>(null);
  const recordingStartedAtRef = useRef<string | null>(null);
  const [showModal, setShowModal] = useState(isOpen);
  const showModalRef = useRef(showModal);
  showModalRef.current = showModal;
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<'video' | 'photo'>('video');
  const [photoCapturing, setPhotoCapturing] = useState(false);
  const [photoFlash, setPhotoFlash] = useState(false);
  /** Seconds elapsed while recording (no UI; drives haptics + auto-stop). */
  const recordingSecondsRef = useRef(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [networkSpeed, setNetworkSpeed] = useState<'fast' | 'slow' | 'offline'>('fast');
  
  // Orientation state
  const [isPortrait, setIsPortrait] = useState(() => deviceIsPortraitViewport());
  const [recordingOrientation, setRecordingOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [videoResolution, setVideoResolution] = useState({ width: 1080, height: 1920 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Parallel audio-only recorder on cloned mic tracks (same capture window) — camera WebM often muxes audio poorly for re-extraction. */
  const auddParallelAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const auddParallelAudioChunksRef = useRef<Blob[]>([]);
  const lastParallelAuddAudioBlobRef = useRef<Blob | null>(null);
  /** Stops parallel AudD-only mic capture after MAX_AUDD_PARALLEL_RECORD_MS so the API never receives a >25s snippet. */
  const auddParallelCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveAuddRecorderRef = useRef<MediaRecorder | null>(null);
  const liveAuddSegmentChunksRef = useRef<Blob[]>([]);
  const liveAuddSegmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveAuddInFlightRef = useRef(false);
  const liveAuddStoppedRef = useRef(true);
  const liveAuddAudioMimeRef = useRef('audio/webm');
  /** Set true for whole record tap so preview→record effect cleanup does not stop the live mic pipeline. */
  const isRecordingRef = useRef(false);
  const liveStabilizerRef = useRef(new LiveSongStabilizer());
  const nativeCaptureActiveRef = useRef(false);
  /** Stabilized song/artist used as caption prefill fallback (not shown on camera). */
  const lastLiveSongMatchRef = useRef<{ artist: string; title: string } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOpenRequested, setCameraOpenRequested] = useState(false);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua);
  const strictPreviewFrames = isIOS || isSafari;
  const previewTapPromptMs = strictPreviewFrames ? 1500 : 3500;
  const [preferredFacingMode, setPreferredFacingMode] = useState<'environment' | 'user'>('environment');
  const [audioEnabled, setAudioEnabled] = useState(true);
  /** Bound to preview <video>; drives loadedmetadata / play without mount-order deadlock */
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewTapToStart, setPreviewTapToStart] = useState(false);
  const primedMediaStreamRef = useRef(primedMediaStream);
  primedMediaStreamRef.current = primedMediaStream;
  const [zoomRange, setZoomRange] = useState<CameraZoomRange | null>(null);
  const [hardwareZoomRange, setHardwareZoomRange] = useState<CameraZoomRange | null>(null);
  const [zoomPresets, setZoomPresets] = useState<number[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [digitalZoomScale, setDigitalZoomScale] = useState(1);
  const zoomLevelRef = useRef(1);
  const zoomAnimCancelRef = useRef<(() => void) | null>(null);
  const pinchZoomRef = useRef<{ dist: number; zoom: number } | null>(null);
  const lastPinchApplyRef = useRef(0);
  /** Dedupe primed adoption within one mount; do not use MediaStream.id (often empty / unstable). */
  const lastAdoptedPrimedRef = useRef<MediaStream | null>(null);
  /** GPS used for lastGeoRef + upload `captureGeo`; JamBase tagging runs on the upload screen only. */
  const [coordsForNearbyVenues, setCoordsForNearbyVenues] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const coordsForNearbyVenuesRef = useRef<{ lat: number; lon: number } | null>(null);
  /** GPS frozen when recording starts — survives long async work before navigate (Chrome can lose gesture-linked geo reads after AudD). */
  const clipGeoAtRecordingStartRef = useRef<{
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null>(null);
  /** Successful prefetch candidate → passed as `location.state.showData` so UploadClip skips resolve-show. */
  const captureResolveCandidateRef = useRef<ClipShowCandidate | null>(null);

  /** JamBase resolve-show preview on camera (before record). */
  const [captureResolvePreview, setCaptureResolvePreview] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'ambiguous' | 'picker' | 'none' | 'error';
    eventTitle: string | null;
    venueName: string | null;
    artistName: string | null;
    locationLine: string | null;
    notice: string | null;
  }>({
    status: 'idle',
    eventTitle: null,
    venueName: null,
    artistName: null,
    locationLine: null,
    notice: null,
  });
  const [captureVenuePickerChoices, setCaptureVenuePickerChoices] = useState<ClipShowCandidate[]>(
    [],
  );
  const [captureVenuePickerSelectedKey, setCaptureVenuePickerSelectedKey] = useState('');

  const captureVenueOptionKey = (venue: ClipShowCandidate) =>
    venue.jambase_venue_id ?? venue.venue_name ?? 'venue';

  const handleCaptureVenuePick = useCallback((venue: ClipShowCandidate) => {
    const crd = coordsForNearbyVenuesRef.current;
    if (!crd || !Number.isFinite(crd.lat) || !Number.isFinite(crd.lon)) return;
    saveCaptureShowSession(venue, crd.lat, crd.lon, { source: 'resolve' });
    captureResolveCandidateRef.current = venue;
    setCaptureVenuePickerSelectedKey(captureVenueOptionKey(venue));
    setCaptureVenuePickerChoices([]);
    const eventTitle = resolveClipEventTitle({
      event_title: venue.event_title,
      artist_name: venue.artist_name,
      venue_name: venue.venue_name,
    });
    setCaptureResolvePreview({
      status: 'ready',
      eventTitle,
      venueName: venue.venue_name?.trim() ?? null,
      artistName: venue.artist_name?.trim() ?? null,
      locationLine: venue.location?.trim() ?? null,
      notice: null,
    });
  }, []);

  useEffect(() => {
    coordsForNearbyVenuesRef.current = coordsForNearbyVenues;
  }, [coordsForNearbyVenues]);

  // Detect network speed
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const updateNetworkSpeed = () => {
        const effectiveType = connection.effectiveType;
        if (!navigator.onLine) {
          setNetworkSpeed('offline');
        } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          setNetworkSpeed('slow');
        } else {
          setNetworkSpeed('fast');
        }
      };
      
      updateNetworkSpeed();
      connection.addEventListener('change', updateNetworkSpeed);
      return () => connection.removeEventListener('change', updateNetworkSpeed);
    }
  }, []);

  const orientationSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset capture coords when modal closes
  useEffect(() => {
    if (!showModal) {
      captureVenueFetchStartedRef.current = false;
      captureGoingAppliedRef.current = false;
      setCoordsForNearbyVenues(null);
      captureResolveCandidateRef.current = null;
      setCaptureVenuePickerChoices([]);
      setCaptureResolvePreview({
        status: 'idle',
        eventTitle: null,
        venueName: null,
        artistName: null,
        locationLine: null,
        notice: null,
      });
    }
  }, [showModal]);

  const captureVenueFetchStartedRef = useRef(false);
  const captureGoingAppliedRef = useRef(false);
  const captureMarksRef = useRef(captureMarks);
  const showMarksHydratedRef = useRef(showMarksHydrated);

  useEffect(() => {
    captureMarksRef.current = captureMarks;
  }, [captureMarks]);

  useEffect(() => {
    showMarksHydratedRef.current = showMarksHydrated;
  }, [showMarksHydrated]);

  const applyGoingCaptureCandidate = useCallback(
    (candidate: ClipShowCandidate, lat?: number, lon?: number) => {
      captureGoingAppliedRef.current = true;
      if (
        lat != null &&
        lon != null &&
        Number.isFinite(lat) &&
        Number.isFinite(lon)
      ) {
        saveCaptureShowSession(candidate, lat, lon, { source: 'going' });
      }
      captureResolveCandidateRef.current = candidate;
      setCaptureVenuePickerChoices([]);
      const eventTitle = resolveClipEventTitle({
        event_title: candidate.event_title,
        artist_name: candidate.artist_name,
        venue_name: candidate.venue_name,
      });
      setCaptureResolvePreview({
        status: 'ready',
        eventTitle,
        venueName: candidate.venue_name?.trim() ?? null,
        artistName: candidate.artist_name?.trim() ?? null,
        locationLine: candidate.location?.trim() ?? null,
        notice: null,
      });
    },
    [],
  );

  /** Going mark overrides venue picker when marks hydrate. */
  useEffect(() => {
    if (!showModal || !showMarksHydrated) return;
    const c = coordsForNearbyVenues;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return;

    const autoFill = resolveCameraGoingAutoFill(
      captureMarks,
      Date.now(),
      c.lat,
      c.lon,
    );
    if (autoFill) {
      applyGoingCaptureCandidate(autoFill.candidate, c.lat, c.lon);
      return;
    }

    const sticky = loadStickyCaptureShowSession({
      lat: c.lat,
      lon: c.lon,
      uploadsInFlight: clipUploadsInFlight > 0,
    });
    if (sticky?.source === 'going') {
      clearCaptureShowSession();
      captureGoingAppliedRef.current = false;
    }
  }, [
    showModal,
    showMarksHydrated,
    captureMarks,
    coordsForNearbyVenues?.lat,
    coordsForNearbyVenues?.lon,
    clipUploadsInFlight,
    applyGoingCaptureCandidate,
  ]);

  /** When GPS is unavailable, fall back to same-day Going / I'm there marks or sticky venue. */
  useEffect(() => {
    if (!showModal || !showMarksHydrated || !captureLaunchGeoResolved) return;
    if (coordsForNearbyVenues) return;
    if (captureGoingAppliedRef.current || captureVenueFetchStartedRef.current) return;

    const autoFill = resolveCameraGoingAutoFill(captureMarks, Date.now());
    if (autoFill) {
      applyGoingCaptureCandidate(autoFill.candidate);
      return;
    }

    const sticky = loadStickyCaptureShowSession({
      uploadsInFlight: clipUploadsInFlight > 0,
    });
    if (sticky) {
      applyGoingCaptureCandidate(sticky.candidate);
    }
  }, [
    showModal,
    showMarksHydrated,
    captureLaunchGeoResolved,
    coordsForNearbyVenues,
    captureMarks,
    applyGoingCaptureCandidate,
  ]);

  /** Prefetch nearest JamBase show for camera HUD — once per modal open. */
  useEffect(() => {
    if (!showModal || !user || isPending) return;
    const c = coordsForNearbyVenues;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) {
      captureResolveCandidateRef.current = null;
      setCaptureVenuePickerChoices([]);
      setCaptureResolvePreview({
        status: 'idle',
        eventTitle: null,
        venueName: null,
        artistName: null,
        locationLine: null,
        notice: null,
      });
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    const resolveTimeoutId = setTimeout(() => ac.abort(), 25_000);

    const applySessionCandidate = (cand: ClipShowCandidate, opts?: { picker?: boolean }) => {
      captureResolveCandidateRef.current = cand;
      const eventTitle = resolveClipEventTitle({
        event_title: cand.event_title,
        artist_name: cand.artist_name,
        venue_name: cand.venue_name,
      });
      setCaptureResolvePreview({
        status: opts?.picker ? 'picker' : 'ready',
        eventTitle,
        venueName: cand.venue_name?.trim() ?? null,
        artistName: cand.artist_name?.trim() ?? null,
        locationLine: cand.location?.trim() ?? null,
        notice: null,
      });
    };

    if (captureVenueFetchStartedRef.current || captureGoingAppliedRef.current) return;

    if (showMarksHydratedRef.current) {
      const autoFill = resolveCameraGoingAutoFill(
        captureMarksRef.current,
        Date.now(),
        c.lat,
        c.lon,
      );
      if (autoFill) {
        applyGoingCaptureCandidate(autoFill.candidate, c.lat, c.lon);
        return;
      }
    }

    void (async () => {
      captureVenueFetchStartedRef.current = true;
      captureResolveCandidateRef.current = null;
      setCaptureVenuePickerChoices([]);
      setCaptureResolvePreview({
        status: 'loading',
        eventTitle: null,
        venueName: null,
        artistName: null,
        locationLine: null,
        notice: null,
      });
      try {
        const captureMs = Date.now();
        const res = await fetch('/api/clips/camera-venues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: ac.signal,
          body: JSON.stringify({
            latitude: c.lat,
            longitude: c.lon,
            at: new Date(captureMs).toISOString(),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          captureVenueFetchStartedRef.current = false;
          captureResolveCandidateRef.current = null;
          setCaptureResolvePreview({
            status: 'error',
            eventTitle: null,
            venueName: null,
            artistName: null,
            locationLine: null,
            notice:
              res.status === 401
                ? 'Sign in again to match venues near you.'
                : res.status === 404
                  ? 'Venue matching is not available yet — deploy the latest worker, or add the venue after you record.'
                  : `Venue lookup failed (${res.status}). Try again or add the venue after you record.`,
          });
          return;
        }
        const data = (await res.json()) as {
          venues?: ClipShowCandidate[];
          notice?: string | null;
          meta?: {
            rawEventCount?: number;
            mappedCandidateCount?: number;
            venueMatchCount?: number;
            captureLocalYmd?: string;
            expandPastVenueCount?: number;
            expandPastEventRawCount?: number;
            expandPastEventMatchedCount?: number;
            geoEventRawCount?: number;
            geoEventMatchedCount?: number;
            matchSource?: 'im_there' | 'going' | 'going_fallback' | 'jambase';
          };
        };
        if (cancelled || captureGoingAppliedRef.current) return;

        const autoFillAfterFetch = showMarksHydratedRef.current
          ? resolveCameraGoingAutoFill(
              captureMarksRef.current,
              captureMs,
              c.lat,
              c.lon,
            )
          : null;
        if (autoFillAfterFetch) {
          applyGoingCaptureCandidate(autoFillAfterFetch.candidate, c.lat, c.lon);
          return;
        }

        const serverVenues = data.venues ?? [];
        if (serverVenues.length > 0) {
          if (isCameraGoingAutoFillSource(data.meta?.matchSource)) {
            applyGoingCaptureCandidate(serverVenues[0]!, c.lat, c.lon);
            return;
          }

          const stickySession = loadStickyCaptureShowSession({
            lat: c.lat,
            lon: c.lon,
            uploadsInFlight: clipUploadsInFlight > 0,
          });
          let selected = serverVenues[0]!;
          if (
            stickySession?.source !== 'going' &&
            stickySession?.candidate &&
            clipCandidateMatchesCameraCaptureDay(
              stickySession.candidate,
              captureMs,
              c.lat,
              c.lon,
            )
          ) {
            const stickyKey = captureVenueOptionKey(stickySession.candidate);
            const matched = serverVenues.find(
              (v) => captureVenueOptionKey(v) === stickyKey,
            );
            if (matched) selected = matched;
          }
          captureResolveCandidateRef.current = selected;
          setCaptureVenuePickerChoices(serverVenues);
          setCaptureVenuePickerSelectedKey(captureVenueOptionKey(selected));
          applySessionCandidate(selected, { picker: true });
          return;
        }

        captureVenueFetchStartedRef.current = false;
        captureResolveCandidateRef.current = null;
        setCaptureVenuePickerChoices([]);

        setCaptureResolvePreview({
          status: 'none',
          eventTitle: null,
          venueName: null,
          artistName: null,
          locationLine: null,
          notice:
            data.notice?.trim() ||
            'No JamBase shows today near you. You can add venue after you record.',
        });
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) {
          if (!cancelled) {
            captureVenueFetchStartedRef.current = false;
            captureResolveCandidateRef.current = null;
            setCaptureVenuePickerChoices([]);
            setCaptureResolvePreview({
              status: 'error',
              eventTitle: null,
              venueName: null,
              artistName: null,
              locationLine: null,
              notice: 'Venue lookup timed out. Try again or add the venue after you record.',
            });
          }
          return;
        }
        captureVenueFetchStartedRef.current = false;
        captureResolveCandidateRef.current = null;
        setCaptureVenuePickerChoices([]);
        setCaptureResolvePreview({
          status: 'error',
          eventTitle: null,
          venueName: null,
          artistName: null,
          locationLine: null,
          notice: 'Venue lookup failed. Try again or add the venue after you record.',
        });
      } finally {
        clearTimeout(resolveTimeoutId);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(resolveTimeoutId);
      ac.abort();
    };
  }, [
    showModal,
    user,
    isPending,
    coordsForNearbyVenues?.lat,
    coordsForNearbyVenues?.lon,
    clipUploadsInFlight,
    applyGoingCaptureCandidate,
  ]);

  /** Device GPS for venue matching — launch-time fix first, then best-effort fallback. */
  useEffect(() => {
    if (!showModal) return;

    const applyCoords = (lat: number, lon: number, accuracy?: number) => {
      lastGeoRef.current = {
        latitude: lat,
        longitude: lon,
        accuracy,
        city: null,
        state: null,
        country: null,
      };
      setCoordsForNearbyVenues({ lat, lon });
    };

    if (
      captureLaunchGeo != null &&
      Number.isFinite(captureLaunchGeo.latitude) &&
      Number.isFinite(captureLaunchGeo.longitude)
    ) {
      applyCoords(
        captureLaunchGeo.latitude,
        captureLaunchGeo.longitude,
        captureLaunchGeo.accuracy,
      );
      return;
    }

    const launchGeoPending =
      captureLaunchGeo !== undefined && !captureLaunchGeoResolved;
    if (launchGeoPending || coordsForNearbyVenues) return;

    let cancelled = false;
    void readDeviceCoordsForNearbyShows().then((g) => {
      if (cancelled || !g) return;
      applyCoords(g.latitude, g.longitude);
    });
    return () => {
      cancelled = true;
    };
  }, [
    showModal,
    captureLaunchGeo,
    captureLaunchGeoResolved,
    coordsForNearbyVenues,
  ]);

  useEffect(() => {
    liveStabilizerRef.current.setPriors(liveSongPriors);
  }, [liveSongPriors]);

  /** Use coordinates we already have (launch tap). Does not call geolocation again. */
  const syncLastGeoFromNearbyCoordsRef = () => {
    const crd = coordsForNearbyVenuesRef.current;
    if (!crd || !Number.isFinite(crd.lat) || !Number.isFinite(crd.lon)) return;
    if (
      lastGeoRef.current?.latitude != null &&
      lastGeoRef.current?.longitude != null &&
      Number.isFinite(lastGeoRef.current.latitude) &&
      Number.isFinite(lastGeoRef.current.longitude)
    ) {
      return;
    }
    const prev = lastGeoRef.current;
    lastGeoRef.current = {
      latitude: crd.lat,
      longitude: crd.lon,
      accuracy: prev?.accuracy,
      city: prev?.city ?? null,
      state: prev?.state ?? null,
      country: prev?.country ?? null,
    };
  };

  /** Plain object for `navigate` state — prefers primed `lastGeoRef`, then nearby coords ref. */
  const snapshotClipGeoForUpload = () => {
    syncLastGeoFromNearbyCoordsRef();
    const lg = lastGeoRef.current;
    if (
      lg &&
      Number.isFinite(lg.latitude) &&
      Number.isFinite(lg.longitude)
    ) {
      return {
        latitude: lg.latitude,
        longitude: lg.longitude,
        city: lg.city ?? null,
        state: lg.state ?? null,
        country: lg.country ?? null,
      };
    }
    const crd = coordsForNearbyVenuesRef.current;
    if (
      crd &&
      Number.isFinite(crd.lat) &&
      Number.isFinite(crd.lon)
    ) {
      return {
        latitude: crd.lat,
        longitude: crd.lon,
        city: null,
        state: null,
        country: null,
      };
    }
    return null;
  };

  const requestPermissions = async (facingOverride?: 'environment' | 'user') => {
    if (isPending) return;
    if (!user) {
      navigate('/auth', { replace: true });
      closeModal();
      return;
    }
    console.log('QuickRecordButton: Requesting camera permissions...');
    setCameraOpenRequested(true);
    setHasPermission(false);
    setCameraReady(false);
    setPreviewTapToStart(false);
    setPermissionDenied(false); // Clear previous denial state
    setCameraError(null);

    const primed = primedMediaStreamRef.current;
    const primedTrack = primed?.getVideoTracks()[0];
    if (
      !shouldUseNativeIosCapture() &&
      primedTrack &&
      primedTrack.readyState === 'live'
    ) {
      console.log('QuickRecordButton: reusing primed camera stream');
      streamRef.current = primed;
      setPreviewStream(primed);
      setPermissionDenied(false);
      const hasAudioTrack = primed.getAudioTracks().length > 0;
      if (!hasAudioTrack) {
        setAudioEnabled(false);
      } else {
        setAudioEnabled(true);
      }
      const activeFacing = primedTrack.getSettings?.()?.facingMode;
      if (activeFacing === 'user' || activeFacing === 'environment') {
        setPreferredFacingMode(activeFacing);
      }
      return primed;
    }

    setPreviewStream(null);
    try {
      if (shouldUseNativeIosCapture()) {
        primed?.getTracks().forEach((track) => track.stop());
        const facing: 'rear' | 'front' =
          facingOverride === 'user' ? 'front' : 'rear';
        if (!isNativeCapturePreviewRunning()) {
          await startNativeCapturePreview({ facing });
        }
        nativeCaptureActiveRef.current = true;
        setPermissionDenied(false);
        setAudioEnabled(true);
        setCameraError(null);
        setHasPermission(true);
        setCameraReady(true);
        setPreviewTapToStart(false);
        setCameraOpenRequested(true);
        setPreferredFacingMode(facing === 'front' ? 'user' : 'environment');
        const zoomState = await readNativeZoomState();
        if (zoomState) {
          setHardwareZoomRange({ min: zoomState.min, max: zoomState.max });
          setZoomRange({ min: zoomState.min, max: zoomState.max });
          setZoomPresets(zoomState.presets);
          setZoomLevel(zoomState.current);
          zoomLevelRef.current = zoomState.current;
        }
        setVideoResolution({
          width: window.screen.width,
          height: window.screen.height,
        });
        return null;
      }

      // Detect current orientation
      const currentIsPortrait = deviceIsPortraitViewport();
      console.log('QuickRecordButton: Current orientation:', currentIsPortrait ? 'portrait' : 'landscape');
      
      // Try high-quality constraints first, then broader compatibility fallbacks.
      const highQualityVideo = currentIsPortrait
        ? {
            width: { ideal: 2160 },
            height: { ideal: 3840 },
            frameRate: { ideal: 30 },
          }
        : {
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 30 },
          };
      const baseVideo = currentIsPortrait
        ? {
            width: { ideal: 1080, min: 640 },
            height: { ideal: 1920, min: 960 },
            frameRate: { ideal: 30, min: 24 },
          }
        : {
            width: { ideal: 1920, min: 960 },
            height: { ideal: 1080, min: 640 },
            frameRate: { ideal: 30, min: 24 },
          };
      const facing = facingOverride ?? preferredFacingMode;
      const orderedFacingModes: ('environment' | 'user')[] =
        facing === 'environment' ? ['environment', 'user'] : ['user', 'environment'];
      const highQualityFacing: MediaTrackConstraints[] = [
        { ...highQualityVideo, facingMode: { ideal: orderedFacingModes[0] } },
        { ...highQualityVideo, facingMode: { ideal: orderedFacingModes[1] } },
      ];
      const heavyFacing: MediaTrackConstraints[] = [
        { ...baseVideo, facingMode: { ideal: orderedFacingModes[0] } },
        { ...baseVideo, facingMode: { ideal: orderedFacingModes[1] } },
      ];
      const facingFirst: MediaTrackConstraints[] =
        facingOverride !== undefined
          ? [
              { facingMode: { exact: orderedFacingModes[0] } },
              { facingMode: { ideal: orderedFacingModes[0] } },
              { facingMode: { ideal: orderedFacingModes[1] } },
            ]
          : [
              { facingMode: { ideal: orderedFacingModes[0] } },
              { facingMode: { ideal: orderedFacingModes[1] } },
            ];
      // Initial open: on phones, never lead with `video: true` — it usually picks the front camera and wins
      // before facingMode hints run. Desktop keeps `true` first (often no "environment" device).
      const videoAttempts: (MediaTrackConstraints | boolean)[] =
        facingOverride !== undefined
          ? [...highQualityFacing, ...heavyFacing, ...facingFirst]
          : isIOS || isAndroid
            ? [...highQualityFacing, ...heavyFacing, ...facingFirst, true]
            : [true, ...highQualityFacing, ...heavyFacing, ...facingFirst];

      const audioConstraintsObj: MediaTrackConstraints = {
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };

      let stream: MediaStream | null = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      for (const video of videoAttempts) {
        let attemptStream: MediaStream | null = null;
        const tryOpen = async (withAudio: boolean) => {
          return navigator.mediaDevices.getUserMedia({
            video,
            audio: withAudio ? audioConstraintsObj : false,
          });
        };
        try {
          attemptStream = await tryOpen(audioEnabled);
        } catch (attemptError) {
          const errName =
            attemptError instanceof DOMException
              ? attemptError.name
              : attemptError instanceof Error
                ? attemptError.name
                : '';
          // NotFoundError = no matching camera/mic device — retrying video-only on the same constraints cannot fix it.
          const maybeMicBlocked =
            audioEnabled &&
            (errName === 'NotAllowedError' ||
              errName === 'OverconstrainedError' ||
              errName === 'AbortError');
          if (maybeMicBlocked) {
            try {
              attemptStream = await tryOpen(false);
              setAudioEnabled(false);
              console.warn('QuickRecordButton: opened camera without audio after:', errName);
            } catch (videoOnlyError) {
              const vName =
                videoOnlyError instanceof DOMException
                  ? videoOnlyError.name
                  : videoOnlyError instanceof Error
                    ? videoOnlyError.name
                    : '';
              if (vName !== 'NotFoundError') {
                console.warn('QuickRecordButton: video-only attempt failed', videoOnlyError);
              }
            }
          } else if (errName !== 'NotFoundError') {
            console.warn('QuickRecordButton: getUserMedia attempt failed', attemptError);
          }
        }
        if (attemptStream) {
          stream = attemptStream;
          break;
        }
      }

      if (!stream) {
        throw new Error('Unable to access camera with available constraints');
      }

      console.log('QuickRecordButton: getUserMedia successful');
      streamRef.current = stream;
      setPreviewStream(stream);

      const activeFacing = stream.getVideoTracks()[0]?.getSettings?.()?.facingMode;
      if (activeFacing === 'user' || activeFacing === 'environment') {
        setPreferredFacingMode(activeFacing);
      }

      setPermissionDenied(false);
      const hasAudioTrack = stream.getAudioTracks().length > 0;
      if (!hasAudioTrack) {
        setAudioEnabled(false);
        setCameraError(
          'Camera opened without microphone access. Song recognition needs audio — allow the microphone for this site, then open Capture again.',
        );
      } else {
        setAudioEnabled(true);
        setCameraError(null);
      }
      
      return stream;
    } catch (err) {
      console.warn('QuickRecordButton: camera access failed:', err);
      setPreviewStream(null);
      const errMessage = err instanceof Error ? err.message : String(err);
      const isNativeIos = shouldUseNativeIosCapture();
      const isNotAllowed =
        (err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) ||
        /permission/i.test(errMessage);
      setPermissionDenied(isNotAllowed);
      const noDeviceHint =
        'No camera was detected (common without a webcam, in Docker, or when the browser cannot access devices). Use the photo library button to pick a video.';
      const fallbackMsg = isNotAllowed
        ? isNativeIos
          ? 'Camera access was denied. Open Settings → Feedback → Camera, allow access, then tap Capture again.'
          : isIOS && isSafari
            ? 'Camera access is blocked for this site. In Settings → Safari → Camera, allow access, then use Capture again.'
            : 'Camera access was denied. Allow camera (and microphone if asked) for this site in your browser settings, then open Capture again.'
        : isAndroid && isChrome
          ? 'Could not start the camera. Close other apps using the camera, then try Capture again.'
          : noDeviceHint;
      setCameraError(err instanceof Error ? `${fallbackMsg} (${err.message})` : fallbackMsg);
      setHasPermission(false);
      setCameraReady(false); // Ensure cameraReady is false on failure
      return null;
    }
  };

  // Keep preview visible when the device rotates — never restart getUserMedia.
  useEffect(() => {
    const applyOrientation = () => {
      const portrait = deviceIsPortraitViewport();
      setIsPortrait(portrait);

      if (!showModalRef.current) return;
      const video = videoRef.current;
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      if (!video || !track || track.readyState !== 'live') return;

      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      void kickCameraPreviewPlay(video);
      if (cameraPreviewHasFrames(video)) {
        setHasPermission(true);
        setCameraReady(true);
        setPreviewTapToStart(false);
      }
      setVideoResolution(
        readCaptureDimensionsFromPreview(video, track, portrait ? 'portrait' : 'landscape'),
      );
    };

    const syncOrientation = () => {
      applyOrientation();
      requestAnimationFrame(applyOrientation);
      if (orientationSyncTimerRef.current) {
        clearTimeout(orientationSyncTimerRef.current);
      }
      orientationSyncTimerRef.current = setTimeout(() => {
        orientationSyncTimerRef.current = null;
        applyOrientation();
      }, 300);
    };

    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    window.visualViewport?.addEventListener('resize', syncOrientation);
    screen.orientation?.addEventListener('change', syncOrientation);

    return () => {
      if (orientationSyncTimerRef.current) {
        clearTimeout(orientationSyncTimerRef.current);
        orientationSyncTimerRef.current = null;
      }
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
      window.visualViewport?.removeEventListener('resize', syncOrientation);
      screen.orientation?.removeEventListener('change', syncOrientation);
    };
  }, []);

  useLayoutEffect(() => {
    if (!showModal) {
      lastAdoptedPrimedRef.current = null;
      return;
    }
    if (!primedMediaStream) return;

    const v0 = primedMediaStream.getVideoTracks()[0];
    if (!v0 || v0.readyState === 'ended') return;

    if (lastAdoptedPrimedRef.current === primedMediaStream) return;
    lastAdoptedPrimedRef.current = primedMediaStream;

    if (streamRef.current && streamRef.current !== primedMediaStream) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = primedMediaStream;
    setCameraOpenRequested(true);
    setPermissionDenied(false);
    setCameraError(null);
    setHasPermission(false);
    setCameraReady(false);
    setPreviewStream(primedMediaStream);
    const primedFacing = v0.getSettings?.()?.facingMode;
    if (primedFacing === 'user' || primedFacing === 'environment') {
      setPreferredFacingMode(primedFacing);
    }
  }, [showModal, primedMediaStream]);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!previewStream) {
      video.srcObject = null;
      setPreviewTapToStart(false);
      return;
    }

    let cancelled = false;
    let marked = false;

    const previewReadyOpts = { strictFrames: strictPreviewFrames };

    const markReady = () => {
      if (cancelled || marked) return;
      if (!cameraPreviewLooksReady(video, previewReadyOpts)) return;
      marked = true;
      setPreviewTapToStart(false);
      setHasPermission(true);
      setCameraReady(true);
      try {
        const vt = previewStream.getVideoTracks()[0];
        const orientation = deviceIsPortraitViewport() ? 'portrait' : 'landscape';
        const dims = readCaptureDimensionsFromPreview(video, vt, orientation);
        setVideoResolution(dims);
      } catch (e) {
        console.warn('QuickRecordButton: preview metadata failed', e);
      }
    };

    const tryMarkFromElement = async () => {
      if (cancelled || marked) return;
      await kickCameraPreviewPlay(video, { waitForMetadata: strictPreviewFrames });
      if (cameraPreviewLooksReady(video, previewReadyOpts)) {
        markReady();
      }
    };

    prepareCameraPreviewElement(video);
    video.srcObject = previewStream;
    void kickCameraPreviewPlay(video);

    const onMeta = () => {
      void tryMarkFromElement();
    };
    const onData = () => {
      void tryMarkFromElement();
    };
    const onCanPlay = () => {
      void tryMarkFromElement();
    };
    const onPlaying = () => {
      void tryMarkFromElement();
    };
    const onResize = () => {
      if (cameraPreviewHasFrames(video)) markReady();
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('loadeddata', onData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('resize', onResize);

    const vTrack = previewStream.getVideoTracks()[0];
    const onTrackUnmute = () => {
      void tryMarkFromElement();
    };
    vTrack?.addEventListener('unmute', onTrackUnmute);

    void tryMarkFromElement();

    let frames = 0;
    const maxFrames = 240;
    const poll = () => {
      if (cancelled || marked) return;
      frames += 1;
      void tryMarkFromElement();
      if (!marked && frames < maxFrames) {
        requestAnimationFrame(poll);
      }
    };
    requestAnimationFrame(poll);

    const retryPlayId = window.setInterval(() => {
      if (cancelled || marked) return;
      void tryMarkFromElement();
    }, 400);

    const tapPromptId = window.setTimeout(() => {
      if (cancelled || marked) return;
      const t = previewStream.getVideoTracks()[0];
      if (t?.readyState === 'live' && !cameraPreviewLooksReady(video, previewReadyOpts)) {
        setPreviewTapToStart(true);
      }
    }, previewTapPromptMs);

    return () => {
      cancelled = true;
      window.clearInterval(retryPlayId);
      window.clearTimeout(tapPromptId);
      vTrack?.removeEventListener('unmute', onTrackUnmute);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('loadeddata', onData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('resize', onResize);
    };
  }, [previewStream, strictPreviewFrames, previewTapPromptMs]);

  const resumePreviewFromTap = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !previewStream) return;
    setPreviewTapToStart(false);
    prepareCameraPreviewElement(video);
    if (video.srcObject !== previewStream) {
      video.srcObject = previewStream;
    }
    await kickCameraPreviewPlay(video, { waitForMetadata: strictPreviewFrames });
    const previewReadyOpts = { strictFrames: strictPreviewFrames };
    if (cameraPreviewLooksReady(video, previewReadyOpts)) {
      setHasPermission(true);
      setCameraReady(true);
      setPreviewTapToStart(false);
      try {
        const vt = previewStream.getVideoTracks()[0];
        const orientation = deviceIsPortraitViewport() ? 'portrait' : 'landscape';
        setVideoResolution(readCaptureDimensionsFromPreview(video, vt, orientation));
      } catch {
        /* optional metadata */
      }
      return;
    }
    setPreviewTapToStart(true);
    setCameraError('Camera preview did not start. Close other apps using the camera, then tap again.');
  }, [previewStream, strictPreviewFrames]);

  useEffect(() => {
    if (!previewStream || !cameraReady || nativeCaptureActiveRef.current) {
      if (nativeCaptureActiveRef.current && cameraReady) {
        void readNativeZoomState().then((zoomState) => {
          if (!zoomState) return;
          setHardwareZoomRange({ min: zoomState.min, max: zoomState.max });
          setZoomRange({ min: zoomState.min, max: zoomState.max });
          setZoomPresets(zoomState.presets);
          setZoomLevel(zoomState.current);
          zoomLevelRef.current = zoomState.current;
        });
      } else if (!nativeCaptureActiveRef.current) {
        setZoomRange(null);
        setHardwareZoomRange(null);
        setZoomPresets([]);
        setZoomLevel(1);
        setDigitalZoomScale(1);
        zoomLevelRef.current = 1;
      }
      if (!previewStream || !cameraReady) return;
    }

    if (nativeCaptureActiveRef.current) return;

    const track = previewStream.getVideoTracks()[0];
    const hardware = readCameraZoomRange(track);
    const range = hardware ? captureZoomRange(hardware) : null;
    setHardwareZoomRange(hardware);
    setZoomRange(range);
    if (hardware && range) {
      setZoomPresets(buildCaptureZoomPresets(range));
      const raw = readCurrentCameraZoom(track, hardware);
      const current = clampCameraZoom(raw, range);
      zoomLevelRef.current = current;
      setZoomLevel(current);
      if (Math.abs(current - raw) > 0.03) {
        void applyCaptureZoom(track, current, hardware, range).then((applied) => {
          if (applied.ok) {
            zoomLevelRef.current = applied.level;
            setZoomLevel(applied.level);
            setDigitalZoomScale(applied.digitalScale);
          }
        });
      } else {
        const decomposed = decomposeCaptureZoom(current, hardware, range);
        setDigitalZoomScale(decomposed.digitalScale);
      }
    } else {
      setZoomPresets([]);
      setZoomLevel(1);
      setDigitalZoomScale(1);
      zoomLevelRef.current = 1;
    }
  }, [previewStream, cameraReady]);

  const applyZoomInstant = useCallback(
    async (next: number) => {
      if (nativeCaptureActiveRef.current) {
        if (!zoomRange) return;
        const target = clampCameraZoom(next, zoomRange);
        await setNativeCaptureZoom(target);
        zoomLevelRef.current = target;
        setZoomLevel(target);
        return;
      }
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || !zoomRange || !hardwareZoomRange) return;
      zoomAnimCancelRef.current?.();
      zoomAnimCancelRef.current = null;
      const applied = await applyCaptureZoom(track, next, hardwareZoomRange, zoomRange);
      if (applied.ok) {
        zoomLevelRef.current = applied.level;
        setZoomLevel(applied.level);
        setDigitalZoomScale(applied.digitalScale);
      }
    },
    [zoomRange, hardwareZoomRange],
  );

  const handleZoomSelect = useCallback(
    async (next: number) => {
      if (nativeCaptureActiveRef.current) {
        if (!zoomRange) return;
        const target = clampCameraZoom(next, zoomRange);
        await setNativeCaptureZoom(target);
        zoomLevelRef.current = target;
        setZoomLevel(target);
        return;
      }
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || !zoomRange || !hardwareZoomRange) return;
      const target = clampCameraZoom(next, zoomRange);
      const from = zoomLevelRef.current;

      zoomAnimCancelRef.current?.();
      zoomAnimCancelRef.current = null;

      const { promise, cancel } = animateCaptureZoom(
        track,
        from,
        target,
        hardwareZoomRange,
        zoomRange,
        {
          onStep: (applied) => {
            zoomLevelRef.current = applied.level;
            setZoomLevel(applied.level);
            setDigitalZoomScale(applied.digitalScale);
          },
        },
      );
      zoomAnimCancelRef.current = cancel;

      const ok = await promise;
      zoomAnimCancelRef.current = null;
      if (ok) {
        const finalZoom = decomposeCaptureZoom(target, hardwareZoomRange, zoomRange);
        zoomLevelRef.current = finalZoom.level;
        setZoomLevel(finalZoom.level);
        setDigitalZoomScale(finalZoom.digitalScale);
      }
    },
    [zoomRange, hardwareZoomRange],
  );

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (!zoomRange || e.touches.length !== 2) return;
    pinchZoomRef.current = {
      dist: touchPairDistance(e.touches),
      zoom: zoomLevel,
    };
    lastPinchApplyRef.current = zoomLevel;
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (!zoomRange || !pinchZoomRef.current || e.touches.length !== 2) return;
    e.preventDefault();
    const next = zoomFromPinchScale(
      pinchZoomRef.current.zoom,
      pinchZoomRef.current.dist,
      touchPairDistance(e.touches),
      zoomRange,
    );
    if (Math.abs(next - lastPinchApplyRef.current) < 0.04) return;
    lastPinchApplyRef.current = next;
    void applyZoomInstant(next);
  };

  const handlePreviewTouchEnd = () => {
    pinchZoomRef.current = null;
  };

  const zoomControlsVisible = hasPermission && cameraReady && zoomPresets.length >= 2;

  const toggleCameraFacing = async () => {
    if (isRecording) return;
    if (nativeCaptureActiveRef.current) {
      await flipNativeCamera();
      setPreferredFacingMode((prev) =>
        prev === 'environment' ? 'user' : 'environment',
      );
      return;
    }
    const track = streamRef.current?.getVideoTracks()[0];
    const currentFacing = track?.getSettings?.()?.facingMode;
    let next: 'environment' | 'user';
    if (currentFacing === 'user') next = 'environment';
    else if (currentFacing === 'environment') next = 'user';
    else next = preferredFacingMode === 'environment' ? 'user' : 'environment';

    const stream = await requestPermissions(next);
    if (stream) {
      const fm = stream.getVideoTracks()[0]?.getSettings?.()?.facingMode;
      if (fm === 'user' || fm === 'environment') {
        setPreferredFacingMode(fm);
      } else {
        setPreferredFacingMode(next);
      }
    }
  };

  const processPickedVideoFile = async (file: File) => {
    const fileIsVideo =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|m4v|webm)$/i.test(file.name);
    if (!fileIsVideo) {
      setCameraError('Please choose a video from your photo library.');
      return;
    }

    const tooLong = await new Promise<boolean>((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      const done = (long: boolean) => {
        URL.revokeObjectURL(url);
        resolve(long);
      };
      video.onloadedmetadata = () => {
        const d = video.duration;
        if (Number.isFinite(d) && d > MAX_CLIP_LENGTH_SECONDS + 1) {
          done(true);
        } else {
          done(false);
        }
      };
      video.onerror = () => done(false);
      video.src = url;
    });
    if (tooLong) {
      setCameraError(`Videos must be ${MAX_CLIP_LENGTH_SECONDS} seconds or shorter.`);
      return;
    }

    releaseAllCaptureResources();

    navigate({ pathname: '/upload', search: '' }, {
      state: {
        videoFile: file,
        fromPhotoLibrary: true,
        recordingStartedAt: new Date(file.lastModified || Date.now()).toISOString(),
      },
    });
    (onAfterCaptureNavigate ?? onClose)?.();
  };

  /** Open the device photo library for videos (not the camera / generic file chooser). */
  const openPhotoLibraryPicker = () => {
    const shouldRestoreCamera = Boolean(streamRef.current && showModalRef.current);
    releaseAllCaptureResources();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,video/*';
    input.style.cssText =
      'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px;pointer-events:none;';
    input.setAttribute('aria-hidden', 'true');

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      if (file) {
        void processPickedVideoFile(file);
        return;
      }
      if (shouldRestoreCamera && showModalRef.current) {
        void requestPermissions();
      }
    };

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null);
    });

    document.body.appendChild(input);

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && !input.files?.length) {
          finish(null);
        }
      }, 400);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  };

  const clearAuddParallelCapTimer = () => {
    if (auddParallelCapTimerRef.current != null) {
      clearTimeout(auddParallelCapTimerRef.current);
      auddParallelCapTimerRef.current = null;
    }
  };

  /** Stop camera, mic, recorders, and live ID — call when capture ends or modal closes. */
  const releaseAllCaptureResources = () => {
    stopLiveAuddPipeline();
    clearAuddParallelCapTimer();

    if (nativeCaptureActiveRef.current) {
      void stopNativeCaptureSession();
      nativeCaptureActiveRef.current = false;
    }

    const par = auddParallelAudioRecorderRef.current;
    auddParallelAudioRecorderRef.current = null;
    if (par) {
      try {
        if (par.state === 'recording' || par.state === 'paused') {
          par.stop();
        }
      } catch {
        /* ignore */
      }
      try {
        par.stream.getTracks().forEach((track) => track.stop());
      } catch {
        /* ignore */
      }
    }
    auddParallelAudioChunksRef.current = [];

    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (mr && (mr.state === 'recording' || mr.state === 'paused')) {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setPreviewStream(null);
    setHasPermission(false);
    setCameraReady(false);
    liveAuddStoppedRef.current = true;
  };

  const finalizeParallelAuddRecorderOnly = (ar: MediaRecorder) => {
    clearAuddParallelCapTimer();
    auddParallelAudioRecorderRef.current = null;
    try {
      ar.stream.getTracks().forEach((track) => track.stop());
    } catch {
      /* ignore */
    }
    const chunks = auddParallelAudioChunksRef.current;
    auddParallelAudioChunksRef.current = [];
    const outMime =
      ar.mimeType && ar.mimeType.length > 0 ? ar.mimeType : 'audio/webm';
    lastParallelAuddAudioBlobRef.current =
      chunks.length > 0 ? new Blob(chunks, { type: outMime }) : null;
  };

  const clearLiveAuddSegmentTimer = () => {
    if (liveAuddSegmentTimerRef.current != null) {
      clearTimeout(liveAuddSegmentTimerRef.current);
      liveAuddSegmentTimerRef.current = null;
    }
  };

  const resetLiveSongIdentification = () => {
    liveStabilizerRef.current.reset();
    lastLiveSongMatchRef.current = null;
  };

  const waitForLiveAuddInFlight = async (maxMs: number): Promise<void> => {
    const deadline = Date.now() + maxMs;
    while (liveAuddInFlightRef.current && Date.now() < deadline) {
      await new Promise((r) => window.setTimeout(r, 80));
    }
  };

  const finalizeCurrentLiveAuddSegment = async (): Promise<void> => {
    liveAuddStoppedRef.current = true;
    clearLiveAuddSegmentTimer();

    const rec = liveAuddRecorderRef.current;
    if (rec && (rec.state === 'recording' || rec.state === 'paused')) {
      if (typeof rec.requestData === 'function') {
        try {
          rec.requestData();
        } catch {
          /* ignore */
        }
      }
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      if (liveAuddRecorderRef.current === rec) {
        liveAuddRecorderRef.current = null;
      }
      await waitForLiveAuddInFlight(LIVE_AUDD_STOP_WAIT_MS);
    }
  };

  const stopLiveAuddRecorder = () => {
    liveAuddStoppedRef.current = true;
    clearLiveAuddSegmentTimer();
    liveAuddSegmentChunksRef.current = [];
    const lr = liveAuddRecorderRef.current;
    liveAuddRecorderRef.current = null;
    if (lr && (lr.state === 'recording' || lr.state === 'paused')) {
      try {
        if (lr.state === 'recording' && typeof lr.requestData === 'function') {
          try {
            lr.requestData();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      try {
        lr.stop();
      } catch {
        /* ignore */
      }
      try {
        lr.stream.getTracks().forEach((track) => track.stop());
      } catch {
        /* ignore */
      }
    }
    liveAuddInFlightRef.current = false;
  };

  const stopLiveAuddPipeline = () => {
    stopLiveAuddRecorder();
    resetLiveSongIdentification();
  };

  const applyLiveSongDisplayed = (displayed: { artist: string; title: string } | null) => {
    if (!displayed || (!displayed.artist && !displayed.title)) return;
    lastLiveSongMatchRef.current = displayed;
  };

  const identifyLiveSegmentBlob = (blob: Blob) => {
    if (liveAuddStoppedRef.current) return;
    if (blob.size < MIN_LIVE_AUDD_CHUNK_BYTES) return;
    if (liveAuddInFlightRef.current) return;
    liveAuddInFlightRef.current = true;
    void (async () => {
      try {
        const r = await identifyMusicWithAudD(blob);
        if (liveAuddStoppedRef.current) return;
        const { displayed } = liveStabilizerRef.current.observe(r);
        applyLiveSongDisplayed(displayed);
      } finally {
        liveAuddInFlightRef.current = false;
      }
    })();
  };

  const beginLiveAuddSegment = (stream: MediaStream, audioMime: string) => {
    if (liveAuddStoppedRef.current) return;

    const liveTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) return;

    clearLiveAuddSegmentTimer();
    liveAuddSegmentChunksRef.current = [];

    try {
      const liveIdStream = new MediaStream(liveTracks.map((t) => t.clone()));
      const liveRec = new MediaRecorder(liveIdStream, {
        mimeType: audioMime,
        audioBitsPerSecond: 96_000,
      });
      liveAuddAudioMimeRef.current = liveRec.mimeType || audioMime;

      liveRec.ondataavailable = (event) => {
        if (event.data.size > 0) liveAuddSegmentChunksRef.current.push(event.data);
      };

      liveRec.onstop = () => {
        try {
          liveIdStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        const chunks = liveAuddSegmentChunksRef.current;
        liveAuddSegmentChunksRef.current = [];
        const outMime =
          liveRec.mimeType && liveRec.mimeType.length > 0
            ? liveRec.mimeType
            : liveAuddAudioMimeRef.current;
        const blob = chunks.length > 0 ? new Blob(chunks, { type: outMime }) : null;
        if (blob) identifyLiveSegmentBlob(blob);
        if (!liveAuddStoppedRef.current) {
          beginLiveAuddSegment(stream, audioMime);
        }
      };

      liveAuddRecorderRef.current = liveRec;
      liveRec.start();

      liveAuddSegmentTimerRef.current = setTimeout(() => {
        liveAuddSegmentTimerRef.current = null;
        const rec = liveAuddRecorderRef.current;
        if (!rec || rec !== liveRec || liveAuddStoppedRef.current) return;
        if (rec.state !== 'recording' && rec.state !== 'paused') return;
        if (typeof rec.requestData === 'function') {
          try {
            rec.requestData();
          } catch {
            /* ignore */
          }
        }
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        if (liveAuddRecorderRef.current === liveRec) {
          liveAuddRecorderRef.current = null;
        }
      }, LIVE_AUDD_SEGMENT_MS);
    } catch (e) {
      console.warn('QuickRecordButton: live song segment failed', e);
    }
  };

  /** Live song ID from mic — starts when preview has audio (before REC) and during capture. */
  const startLiveSongPipeline = (stream: MediaStream): boolean => {
    if (!audioEnabled) return false;
    if (
      !liveAuddStoppedRef.current &&
      (liveAuddRecorderRef.current || liveAuddSegmentTimerRef.current)
    ) {
      return true;
    }

    const liveTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) return false;

    const audioMime = pickAudioRecorderMime();
    if (!audioMime) return false;

    try {
      liveAuddStoppedRef.current = false;
      beginLiveAuddSegment(stream, audioMime);
      return true;
    } catch (e) {
      console.warn('QuickRecordButton: live song pipeline failed', e);
      return false;
    }
  };

  /** Start live song ID as soon as camera preview has mic (before user taps record). */
  useEffect(() => {
    if (!showModal || !hasPermission || !cameraReady || isRecording) return;

    // Native iOS uses Capgo camera-preview behind the webview. Starting a separate mic
    // capture (AVAudioSession) during preview triggers the microphone permission sheet and
    // can interrupt the camera session / make the home feed show through the webview.
    if (nativeCaptureActiveRef.current) {
      return;
    }

    const stream = streamRef.current;
    if (!stream || !audioEnabled || stream.getAudioTracks().length === 0) return;
    startLiveSongPipeline(stream);
    return () => {
      if (!isRecordingRef.current) {
        stopLiveAuddRecorder();
      }
    };
  }, [showModal, hasPermission, cameraReady, isRecording, previewStream, audioEnabled]);

  const startRecording = async () => {
    // Only start if camera is ready
    if (
      !hasPermission ||
      (!streamRef.current && !nativeCaptureActiveRef.current)
    ) {
      return;
    }

    isRecordingRef.current = true;

    if (nativeCaptureActiveRef.current) {
      const currentOrientation = deviceIsPortraitViewport() ? 'portrait' : 'landscape';
      setRecordingOrientation(currentOrientation);
      setIsPortrait(currentOrientation === 'portrait');
      setVideoResolution({
        width: window.screen.width,
        height: window.screen.height,
      });
      await nativeCaptureHaptic('light');
      recordingStartedAtRef.current = new Date().toISOString();
      clipGeoAtRecordingStartRef.current = snapshotClipGeoForUpload();

      try {
        await stopNativeLiveAudioSegments();
        await startNativeVideoRecording();
        setIsRecording(true);
        recordingSecondsRef.current = 0;
        timerRef.current = setInterval(() => {
          recordingSecondsRef.current += 1;
          const t = recordingSecondsRef.current;
          if (t === HAPTIC_WARNING_TIME) {
            void nativeCaptureWarningHaptic();
          }
          if (t >= NATIVE_CAPTURE_MAX_SECONDS) {
            stopRecording();
          }
        }, 1000);
      } catch (err) {
        console.error('Native recording failed:', err);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
      return;
    }

    const stream = streamRef.current!;

    // Capture current orientation when recording starts (read live — state may lag rotation).
    const currentOrientation = deviceIsPortraitViewport() ? 'portrait' : 'landscape';
    setRecordingOrientation(currentOrientation);
    setIsPortrait(currentOrientation === 'portrait');

    const videoTrack = stream.getVideoTracks()[0];
    const capturedResolution = readCaptureDimensionsFromPreview(
      videoRef.current,
      videoTrack,
      currentOrientation,
    );
    setVideoResolution(capturedResolution);

    // Light haptic pulse to confirm recording started
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    recordingStartedAtRef.current = new Date().toISOString();
    clipGeoAtRecordingStartRef.current = snapshotClipGeoForUpload();

    try {
      clearAuddParallelCapTimer();
      const hasAudio = stream.getAudioTracks().length > 0;
      const preferMp4 = isIOS || isSafari || isAppleMediaRecorderPlatform();
      const mimeType = pickVideoRecorderMime({ hasAudio, preferMp4 }) ?? '';
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: preferMp4 ? 10_000_000 : 5_000_000,
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      if (hasAudio) {
        recorderOptions.audioBitsPerSecond = 192_000;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const outType =
          mediaRecorder.mimeType && mediaRecorder.mimeType.length > 0
            ? mediaRecorder.mimeType
            : mimeType || (preferMp4 ? 'video/mp4' : 'video/webm');
        const blob = new Blob(chunksRef.current, { type: outType });
        handleRecordingComplete(blob);
      };

      mediaRecorder.start(100); // Capture data every 100ms for smoother recording
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      recordingSecondsRef.current = 0;

      lastParallelAuddAudioBlobRef.current = null;
      auddParallelAudioChunksRef.current = [];
      auddParallelAudioRecorderRef.current = null;
      if (hasAudio && audioEnabled) {
        try {
          const audioMime = pickAudioRecorderMime();
          if (audioMime) {
            const liveTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
            if (liveTracks.length > 0) {
              const clones = liveTracks.map((t) => t.clone());
              const audStream = new MediaStream(clones);
              const ar = new MediaRecorder(audStream, {
                mimeType: audioMime,
                audioBitsPerSecond: 128_000,
              });
              ar.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  auddParallelAudioChunksRef.current.push(event.data);
                }
              };
              ar.start();
              auddParallelAudioRecorderRef.current = ar;

              startLiveSongPipeline(stream);
            }
          }
        } catch (e) {
          console.warn('QuickRecordButton: parallel AudD audio recorder failed', e);
        }
      }

      // Start timer
      timerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        const t = recordingSecondsRef.current;
        if (t === HAPTIC_WARNING_TIME && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        if (t >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      console.error('Recording failed:', err);
      isRecordingRef.current = false;
      stopLiveAuddPipeline();
    }
  };

  const stopRecording = () => {
    if (nativeCaptureActiveRef.current) {
      void (async () => {
        try {
          const { videoFilePath } = await stopNativeVideoRecording();
          isRecordingRef.current = false;
          setIsRecording(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          const blob = await nativeVideoPathToBlob(videoFilePath);
          await handleRecordingComplete(blob, { nativeVideoPath: videoFilePath });
        } catch (err) {
          console.error('Native stop recording failed:', err);
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      })();
      return;
    }

    const mr = mediaRecorderRef.current;
    if (!mr || (mr.state !== 'recording' && mr.state !== 'paused')) {
      return;
    }

    void (async () => {
      await finalizeCurrentLiveAuddSegment();

      clearAuddParallelCapTimer();

      const ar = auddParallelAudioRecorderRef.current;

      const finalizeMainRecorder = () => {
        if (mr.state === 'recording' || mr.state === 'paused') {
          if (mr.state === 'recording' && typeof mr.requestData === 'function') {
            try {
              mr.requestData();
            } catch {
              /* ignore */
            }
          }
          mr.stop();
        }
        isRecordingRef.current = false;
        setIsRecording(false);

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      if (ar && (ar.state === 'recording' || ar.state === 'paused')) {
        ar.onstop = () => {
          finalizeParallelAuddRecorderOnly(ar);
          finalizeMainRecorder();
        };
        if (typeof ar.requestData === 'function') {
          try {
            ar.requestData();
          } catch {
            /* ignore */
          }
        }
        ar.stop();
      } else {
        finalizeMainRecorder();
      }
    })();
  };

  const handleRecordingComplete = async (
    blob: Blob,
    opts?: { skipAudd?: boolean; nativeVideoPath?: string },
  ) => {
    try {
      const par = auddParallelAudioRecorderRef.current;
      if (
        !opts?.skipAudd &&
        par &&
        (par.state === 'recording' || par.state === 'paused')
      ) {
        await new Promise<void>((resolve) => {
          par.onstop = () => {
            finalizeParallelAuddRecorderOnly(par);
            resolve();
          };
          try {
            if (typeof par.requestData === 'function') par.requestData();
          } catch {
            /* ignore */
          }
          par.stop();
        });
      } else if (
        !opts?.skipAudd &&
        !lastParallelAuddAudioBlobRef.current &&
        auddParallelAudioChunksRef.current.length > 0
      ) {
        const outMime =
          liveAuddAudioMimeRef.current && liveAuddAudioMimeRef.current.length > 0
            ? liveAuddAudioMimeRef.current
            : 'audio/webm';
        lastParallelAuddAudioBlobRef.current = new Blob(auddParallelAudioChunksRef.current, {
          type: outMime,
        });
        auddParallelAudioChunksRef.current = [];
      }

      const captureAudioBlob = opts?.skipAudd ? null : lastParallelAuddAudioBlobRef.current;
      lastParallelAuddAudioBlobRef.current = null;

      if (!opts?.skipAudd && !lastLiveSongMatchRef.current && captureAudioBlob) {
        if (captureAudioBlob.size >= MIN_LIVE_AUDD_CHUNK_BYTES) {
          try {
            const r = await identifyMusicWithAudD(captureAudioBlob);
            const { displayed } = liveStabilizerRef.current.observe(r);
            applyLiveSongDisplayed(displayed);
          } catch (e) {
            console.warn('QuickRecordButton: post-capture song identify failed', e);
          }
        }
      }

      releaseAllCaptureResources();

      const at = recordingStartedAtRef.current || new Date().toISOString();
      const geo =
        clipGeoAtRecordingStartRef.current ?? snapshotClipGeoForUpload();
      clipGeoAtRecordingStartRef.current = null;

      const sourceKey = auddSourceKey(blob);
      const auddPrefill = auddPrefillFromLiveMatch(
        sourceKey,
        lastLiveSongMatchRef.current,
      );

      const sticky =
        loadStickyCaptureShowSession({
          lat: geo?.latitude,
          lon: geo?.longitude,
          uploadsInFlight: clipUploadsInFlight > 0,
        });
      const goingCandidate =
        geo &&
        Number.isFinite(geo.latitude) &&
        Number.isFinite(geo.longitude) &&
        showMarksHydrated
          ? resolveCameraGoingAutoFill(
              captureMarks,
              Date.parse(at) || Date.now(),
              geo.latitude,
              geo.longitude,
            )?.candidate ?? null
          : showMarksHydrated
            ? resolveCameraGoingAutoFill(captureMarks, Date.parse(at) || Date.now())?.candidate ??
              null
            : null;
      const prefetchShow =
        goingCandidate ??
        captureResolveCandidateRef.current ??
        sticky?.candidate ??
        null;
      navigate(
        { pathname: '/upload', search: '' },
        {
          replace: true,
          state: {
            videoBlob: blob,
            ...(opts?.nativeVideoPath ? { nativeVideoPath: opts.nativeVideoPath } : {}),
            captureAudioBlob,
            recordingStartedAt: at,
            captureGeo: geo
              ? {
                  latitude: geo.latitude,
                  longitude: geo.longitude,
                  city: geo.city,
                  state: geo.state,
                  country: geo.country,
                }
              : null,
            videoMetadata: {
              recording_orientation: recordingOrientation,
              video_resolution_w: videoResolution.width,
              video_resolution_h: videoResolution.height,
            },
            auddPrefill,
            ...(prefetchShow
              ? { showData: clipShowCandidateToNavState(prefetchShow) }
              : {}),
          },
        },
      );
      (onAfterCaptureNavigate ?? onClose)?.();

      recordingStartedAtRef.current = null;
      lastGeoRef.current = null;

      setShowModal(false);
      setHasPermission(false);
      setCameraReady(false);
      setCaptureMode('video');
      setPhotoCapturing(false);
      setPhotoFlash(false);
      setPreviewStream(null);
      setCameraOpenRequested(false);
      recordingSecondsRef.current = 0;
      lastLiveSongMatchRef.current = null;
    } catch (e) {
      console.error('QuickRecordButton: recording complete failed', e);
      setCameraError('Could not open your clip for review. Try again.');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const capturePhoto = async () => {
    if (
      !hasPermission ||
      (!streamRef.current && !nativeCaptureActiveRef.current) ||
      isRecording ||
      photoCapturing
    ) {
      return;
    }

    setPhotoCapturing(true);
    isRecordingRef.current = true;

    const currentOrientation = deviceIsPortraitViewport() ? 'portrait' : 'landscape';
    setRecordingOrientation(currentOrientation);
    setIsPortrait(currentOrientation === 'portrait');

    if (nativeCaptureActiveRef.current) {
      setVideoResolution({
        width: window.screen.width,
        height: window.screen.height,
      });
    } else {
      const videoTrack = streamRef.current!.getVideoTracks()[0];
      const capturedResolution = readCaptureDimensionsFromPreview(
        videoRef.current,
        videoTrack,
        currentOrientation,
      );
      setVideoResolution(capturedResolution);
    }

    await nativeCaptureHaptic('light');

    recordingStartedAtRef.current = new Date().toISOString();
    clipGeoAtRecordingStartRef.current = snapshotClipGeoForUpload();

    try {
      stopLiveAuddRecorder();
      void stopNativeLiveAudioSegments();
      setPhotoFlash(true);
      window.setTimeout(() => setPhotoFlash(false), 120);

      let photoBlob: Blob;
      if (nativeCaptureActiveRef.current) {
        photoBlob = await captureNativePhoto();
      } else {
        photoBlob = await capturePhotoFromStream(
          streamRef.current!,
          videoRef.current,
          currentOrientation,
        );
      }
      const videoBlob = await photoBlobToStillVideoBlob(photoBlob);
      await handleRecordingComplete(videoBlob, { skipAudd: true });
    } catch (err) {
      console.error('Photo capture failed:', err);
      setCameraError('Could not capture photo. Try again.');
      isRecordingRef.current = false;
    } finally {
      setPhotoCapturing(false);
    }
  };

  const closeModal = () => {
    isRecordingRef.current = false;
    releaseAllCaptureResources();
    lastParallelAuddAudioBlobRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowModal(false);
    setIsRecording(false);
    setCaptureMode('video');
    setPhotoCapturing(false);
    setPhotoFlash(false);
    setHasPermission(false);
    setCameraReady(false);
    setCameraOpenRequested(false);
    setPreviewTapToStart(false);
    recordingSecondsRef.current = 0;
    lastGeoRef.current = null;
    clipGeoAtRecordingStartRef.current = null;
    lastAdoptedPrimedRef.current = null;

    // Call onClose callback if provided
    if (onClose) {
      onClose();
    }
  };
  
  // Sync external isOpen prop with internal state
  useEffect(() => {
    if (isOpen) {
      setShowModal(true);
      return;
    }
    if (showModalRef.current) {
      closeModal();
    }
  }, [isOpen]);

  // If capture UI unmounts while native preview is active, stop the native session.
  useEffect(() => {
    return () => {
      if (nativeCaptureActiveRef.current) {
        void stopNativeCaptureSession();
        nativeCaptureActiveRef.current = false;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (video && showModal) prepareCameraPreviewElement(video);
  }, [showModal]);

  // Launcher may have already started native preview on the Capture tap (iOS).
  useEffect(() => {
    if (!showModal || !shouldUseNativeIosCapture() || !isNativeCapturePreviewRunning()) {
      return;
    }
    if (nativeCaptureActiveRef.current && hasPermission && cameraReady) {
      return;
    }
    nativeCaptureActiveRef.current = true;
    setPermissionDenied(false);
    setAudioEnabled(true);
    setCameraError(null);
    setHasPermission(true);
    setCameraReady(true);
    setPreviewTapToStart(false);
    setCameraOpenRequested(true);
    void readNativeZoomState().then((zoomState) => {
      if (!zoomState) return;
      setHardwareZoomRange({ min: zoomState.min, max: zoomState.max });
      setZoomRange({ min: zoomState.min, max: zoomState.max });
      setZoomPresets(zoomState.presets);
      setZoomLevel(zoomState.current);
      zoomLevelRef.current = zoomState.current;
    });
    setVideoResolution({
      width: window.screen.width,
      height: window.screen.height,
    });
  }, [showModal, hasPermission, cameraReady]);

  // Trigger camera when modal opens (skip when parent primed stream, or while waiting for launch-time GPS)
  useEffect(() => {
    if (!autoRequestCamera) return;
    if (deferCameraUntilLaunchGeo && !captureLaunchGeoResolved) {
      return;
    }
    if (gestureCameraPrimingPending) return;
    const primedLive =
      primedMediaStream?.getVideoTracks()[0]?.readyState === 'live';
    const previewLive =
      previewStream?.getVideoTracks()[0]?.readyState === 'live';
    if (primedLive || previewLive) return;
    if (showModal && !permissionDenied && !cameraOpenRequested) {
      console.log('QuickRecordButton: Modal opened, requesting camera permissions...');
      void requestPermissions();
    }
  }, [
    showModal,
    permissionDenied,
    cameraOpenRequested,
    autoRequestCamera,
    deferCameraUntilLaunchGeo,
    captureLaunchGeo,
    captureLaunchGeoResolved,
    gestureCameraPrimingPending,
    primedMediaStream,
    previewStream,
  ]);

  // Responsive layout — video layer is always full-screen; only chrome styling changes on rotate.
  const landscapeCapture = !isPortrait;
  const isNativeIosCapture = shouldUseNativeIosCapture();
  const previewTrackLive = previewStream?.getVideoTracks()[0]?.readyState === 'live';
  const nativePreviewLive =
    isNativeIosCapture &&
    isNativeCapturePreviewRunning() &&
    hasPermission &&
    cameraReady;
  const previewLive = previewTrackLive || nativePreviewLive;
  const showStartupOverlay =
    !previewTapToStart && !permissionDenied && !previewLive && (!hasPermission || !cameraReady);
  const useTransparentNativePreview = nativePreviewLive;

  const captureControls = (
    <>
      {hasPermission && cameraReady && !landscapeCapture && (
        <div className="mx-auto mb-3 w-full max-w-lg px-1">
          {deferCameraUntilLaunchGeo && !captureLaunchGeoResolved && (
            <p className="text-center text-momentum-flare/90 text-xs mb-2 flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              {shouldUseNativeIosCapture()
                ? 'Getting your location to match nearby venues…'
                : 'Waiting for location permission — allow it when the browser asks so we can match venues.'}
            </p>
          )}
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-momentum-flare mt-0.5" />
            <div className="min-w-0 flex-1 text-left space-y-1">
              {!coordsForNearbyVenues ? (
                <p className="text-gray-300 text-[11px] leading-snug flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-momentum-flare" />
                  {captureLaunchGeoResolved
                    ? 'Location unavailable — allow GPS to match venues near you.'
                    : 'Getting your location to match nearby venues…'}
                </p>
              ) : (
                <>
                {(captureResolvePreview.status === 'idle' ||
                  captureResolvePreview.status === 'loading') && (
                  <p className="text-gray-300 text-[11px] leading-snug flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-momentum-flare" />
                    Matching nearest JamBase show at your location…
                  </p>
                )}
                {(captureResolvePreview.status === 'ready' ||
                  captureResolvePreview.status === 'ambiguous' ||
                  captureResolvePreview.status === 'picker') && (
                  <>
                    {captureResolvePreview.eventTitle ? (
                      <p className="text-white text-sm font-bold leading-snug line-clamp-2">
                        {captureResolvePreview.eventTitle}
                      </p>
                    ) : captureResolvePreview.venueName ? (
                      <p className="text-white text-xs font-semibold leading-snug truncate">
                        {captureResolvePreview.venueName}
                      </p>
                    ) : null}
                    {captureResolvePreview.venueName &&
                    captureResolvePreview.eventTitle &&
                    !captureResolvePreview.eventTitle
                      .toLowerCase()
                      .includes(captureResolvePreview.venueName.toLowerCase()) ? (
                      <p className="text-gray-300 text-[11px] leading-snug truncate">
                        {captureResolvePreview.venueName}
                      </p>
                    ) : null}
                    {captureResolvePreview.artistName &&
                    captureResolvePreview.eventTitle &&
                    !captureResolvePreview.eventTitle
                      .toLowerCase()
                      .includes(captureResolvePreview.artistName.toLowerCase()) ? (
                      <p className="text-momentum-flare/95 text-[11px] leading-snug flex items-start gap-1.5">
                        <Music className="w-3 h-3 shrink-0 mt-0.5 text-momentum-rose/80" />
                        <span>{captureResolvePreview.artistName}</span>
                      </p>
                    ) : captureResolvePreview.artistName && !captureResolvePreview.eventTitle ? (
                      <p className="text-momentum-flare/95 text-[11px] leading-snug flex items-start gap-1.5">
                        <Music className="w-3 h-3 shrink-0 mt-0.5 text-momentum-rose/80" />
                        <span>{captureResolvePreview.artistName}</span>
                      </p>
                    ) : null}
                    {captureResolvePreview.locationLine ? (
                      <p className="text-gray-500 text-[10px] leading-snug">
                        {captureResolvePreview.locationLine}
                      </p>
                    ) : null}
                    {captureResolvePreview.status === 'picker' &&
                    captureVenuePickerChoices.length > 0 ? (
                      <div className="pt-2 space-y-1.5">
                        <label
                          htmlFor="capture-venue-picker"
                          className="text-[10px] font-medium text-gray-300"
                        >
                          {captureVenuePickerChoices.length > 1
                            ? 'Shows tonight nearby — pick your venue'
                            : 'Show tonight at nearest venue'}
                        </label>
                        <select
                          id="capture-venue-picker"
                          className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-[11px] text-white"
                          value={captureVenuePickerSelectedKey}
                          onChange={(e) => {
                            const picked = captureVenuePickerChoices.find(
                              (v) => captureVenueOptionKey(v) === e.target.value,
                            );
                            if (picked) handleCaptureVenuePick(picked);
                          }}
                        >
                          {captureVenuePickerChoices.map((venue) => {
                            const key = captureVenueOptionKey(venue);
                            const distLabel =
                              venue.distance_miles != null &&
                              Number.isFinite(venue.distance_miles)
                                ? ` (${venue.distance_miles.toFixed(1)} mi)`
                                : '';
                            const label = [
                              venue.venue_name ?? 'Venue',
                              venue.artist_name,
                            ]
                              .filter(Boolean)
                              .join(' · ');
                            return (
                              <option key={key} value={key}>
                                {label}
                                {distLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : null}
                  </>
                )}
                {captureResolvePreview.status === 'none' && (
                  <p className="text-gray-300 text-[11px] leading-snug">
                    {captureResolvePreview.notice ??
                      'Location saved. No JamBase show matched here yet — you can add venue after you record.'}
                  </p>
                )}
                {captureResolvePreview.status === 'error' && (
                  <p className="text-gray-300 text-[11px] leading-snug">
                    {captureResolvePreview.notice ??
                      'Couldn\u2019t preview venue; we\u2019ll try again after you record.'}
                  </p>
                )}
                {!isRecording ? (
                  <p className="text-gray-500 text-[10px] leading-snug pt-1">
                    Saved with this clip — edit on the next screen.
                  </p>
                ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {hasPermission && cameraReady && landscapeCapture && captureResolvePreview.eventTitle ? (
        <p className="pointer-events-none mx-auto mb-2 max-w-xl truncate px-1 text-center text-[11px] font-semibold text-white/90">
          {captureResolvePreview.eventTitle}
        </p>
      ) : null}

      {zoomControlsVisible ? (
        <div
          className={`mx-auto flex w-full justify-center px-1 ${
            landscapeCapture ? 'mb-2' : 'mb-4 max-w-lg'
          }`}
        >
          <CameraZoomControls
            presets={zoomPresets}
            value={zoomLevel}
            disabled={isRecording}
            onSelect={(z) => void handleZoomSelect(z)}
          />
        </div>
      ) : null}

      <div
        className={`mx-auto flex w-full justify-center px-1 ${
          landscapeCapture ? 'mb-2' : 'mb-3'
        }`}
      >
        <div
          className="inline-flex rounded-full bg-black/40 p-0.5 ring-1 ring-white/15"
          role="group"
          aria-label="Capture mode"
        >
          <button
            type="button"
            disabled={isRecording || photoCapturing}
            onClick={() => setCaptureMode('video')}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              captureMode === 'video'
                ? 'bg-white text-gray-900'
                : 'text-white/80 hover:text-white'
            }`}
            aria-pressed={captureMode === 'video'}
          >
            <Film className="h-3.5 w-3.5" />
            Video
          </button>
          <button
            type="button"
            disabled={isRecording || photoCapturing}
            onClick={() => setCaptureMode('photo')}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
              captureMode === 'photo'
                ? 'bg-white text-gray-900'
                : 'text-white/80 hover:text-white'
            }`}
            aria-pressed={captureMode === 'photo'}
          >
            <Camera className="h-3.5 w-3.5" />
            Photo
          </button>
        </div>
      </div>

      <div
        className={`mx-auto grid w-full grid-cols-3 items-end gap-2 transition-all duration-300 ease-in-out ${
          isPortrait ? 'max-w-lg' : 'max-w-2xl'
        }`}
      >
        <div className="flex justify-start gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="w-14 h-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
          >
            <span className="text-xl">✕</span>
          </button>
          <button
            type="button"
            onClick={openPhotoLibraryPicker}
            className="w-14 h-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
            title="Photo library"
            aria-label="Choose video from photo library"
          >
            <Images className="w-6 h-6" />
          </button>
        </div>

        <div className="flex justify-center pb-0.5">
          {captureMode === 'video' ? (
            !isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={!cameraReady}
                className="relative group disabled:opacity-50 shrink-0"
                title="Start capturing your moment (up to 60 seconds)"
                style={{ minWidth: '5rem', minHeight: '5rem' }}
              >
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                  <Circle className="w-16 h-16 text-red-500 fill-red-500" />
                </div>
                {cameraReady && !landscapeCapture && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-white text-xs font-medium">Capture</span>
                  </div>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="relative group shrink-0"
                title="Stop recording and save your moment"
                style={{ minWidth: '5rem', minHeight: '5rem' }}
              >
                <div className="on-light-surface w-20 h-20 rounded-full bg-white/80 flex items-center justify-center">
                  <Square className="w-10 h-10 text-gray-800 fill-gray-800" />
                </div>
                {!landscapeCapture && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-white text-xs font-medium">End Moment</span>
                  </div>
                )}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => void capturePhoto()}
              disabled={!cameraReady || photoCapturing}
              className="relative group disabled:opacity-50 shrink-0"
              title="Take a photo"
              style={{ minWidth: '5rem', minHeight: '5rem' }}
            >
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-[5px] border-white bg-white" />
              </div>
              {cameraReady && !landscapeCapture && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-white text-xs font-medium">
                    {photoCapturing ? 'Saving…' : 'Photo'}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-col items-end justify-end">
          <button
            type="button"
            onClick={toggleCameraFacing}
            disabled={isRecording || photoCapturing}
            className="w-14 h-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
            title="Flip camera"
          >
            <RefreshCw className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Floating Action Button - Hidden on all screen sizes (functionality moved to MobileBottomNav) */}
      {/* <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-br from-momentum-ember via-momentum-flare to-momentum-rose rounded-full shadow-2xl shadow-momentum-ember/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform group hidden"
        title="Film your moment"
      >
        <Film className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
      </button> */}

      {/* Recording Modal */}
      {showModal && (
        <div
          className={`fixed inset-0 z-[120] h-[100dvh] w-full overflow-hidden ${
            useTransparentNativePreview ? 'bg-transparent' : 'bg-black'
          }`}
        >
          {/* Camera preview — always full viewport; layout must not change on device rotation. */}
          <div
            className={`absolute inset-0 z-0 touch-none overflow-hidden ${
              useTransparentNativePreview ? 'bg-transparent' : 'bg-black'
            }`}
            onTouchStart={handlePreviewTouchStart}
            onTouchMove={handlePreviewTouchMove}
            onTouchEnd={handlePreviewTouchEnd}
            onTouchCancel={handlePreviewTouchEnd}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              disablePictureInPicture
              className={`absolute inset-0 z-0 h-full w-full min-h-full min-w-full object-cover ${
                isNativeIosCapture ? 'pointer-events-none opacity-0' : ''
              }`}
              style={{
                transform: digitalZoomScale > 1 ? `scale(${digitalZoomScale})` : undefined,
                transformOrigin: 'center center',
                transition: 'transform 0.12s ease-out',
              }}
            />
            {previewTapToStart && previewStream && !cameraReady && (
              <button
                type="button"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center"
                onClick={() => void resumePreviewFromTap()}
              >
                <Film className="w-12 h-12 text-momentum-flare" aria-hidden />
                <span className="text-white font-semibold">Tap to start camera preview</span>
                <span className="text-gray-400 text-xs max-w-xs">
                  {strictPreviewFrames
                    ? 'Safari sometimes needs an extra tap after you allow camera access.'
                    : 'Your browser sometimes needs an extra tap after you allow camera access.'}
                </span>
              </button>
            )}
            {showStartupOverlay && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto text-center space-y-4 p-6 max-w-sm rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10">
                  <Film className="w-16 h-16 text-gray-400 mx-auto" />
                  <Loader2 className="w-8 h-8 text-momentum-flare animate-spin mx-auto mb-2" />
                  <p className="text-white text-sm">
                    {gestureCameraPrimingPending
                      ? 'Use the camera prompt if it appears…'
                      : 'Starting camera…'}
                  </p>
                  <p className="text-momentum-flare/90 text-xs mt-2 max-w-xs mx-auto">
                    {shouldUseNativeIosCapture()
                      ? 'Allow Camera when iOS asks. Location runs right after so we can match JamBase venues.'
                      : 'Location is requested when you tap Capture (with the camera) so we can match JamBase venues to your clip on the next screen.'}
                  </p>
                  {cameraError && <p className="text-red-400 text-xs mt-2">{cameraError}</p>}
                </div>
              </div>
            )}
            {permissionDenied && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto text-center space-y-4 p-6 max-w-sm rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10">
                  <Film className="w-16 h-16 text-gray-400 mx-auto" />
                  <h3 className="text-xl font-bold text-white">Camera blocked</h3>
                  <p className="text-gray-400 text-sm">
                    {shouldUseNativeIosCapture()
                      ? 'Open Settings → Feedback → Camera and allow access, then tap Capture again. You can also use the photo library button below.'
                      : 'Use your device settings to allow the camera for this site, then tap Capture again. You can also use the photo library button below to pick a video.'}
                  </p>
                  {cameraError && <p className="text-red-400/90 text-xs mt-2">{cameraError}</p>}
                </div>
              </div>
            )}

            {photoFlash && (
              <div
                className="pointer-events-none absolute inset-0 z-20 bg-white animate-pulse"
                aria-hidden
              />
            )}

            {isRecording && (
              <div
                className="absolute z-10 transition-all duration-300 ease-in-out"
                style={{
                  top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                  left: '1rem',
                }}
              >
                <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 px-3 py-1 rounded-lg flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-sm font-bold">REC</span>
                </div>
              </div>
            )}

            {hasPermission && networkSpeed === 'slow' && (
              <div
                className="absolute left-4 right-4 z-10 transition-all duration-300 ease-in-out"
                style={{
                  bottom: landscapeCapture
                    ? 'max(6.5rem, calc(env(safe-area-inset-bottom, 0px) + 5.5rem))'
                    : 'max(10rem, calc(env(safe-area-inset-bottom, 1rem) + 9rem))',
                }}
              >
                <div className="bg-momentum-ember/15 backdrop-blur-md border border-momentum-ember/40 px-4 py-2 rounded-lg">
                  <p className="text-white text-xs">Slow connection—your clip will upload when you post</p>
                </div>
              </div>
            )}
          </div>

          <div
            className={
              landscapeCapture
                ? 'pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-8'
                : 'pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/90 backdrop-blur-lg'
            }
            style={{
              paddingTop: landscapeCapture ? undefined : '1.5rem',
              paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
              paddingLeft: landscapeCapture ? '1rem' : '1.5rem',
              paddingRight: landscapeCapture ? '1rem' : '1.5rem',
            }}
          >
            <div className="pointer-events-auto">{captureControls}</div>
          </div>
        </div>
      )}
    </>
  );
}
