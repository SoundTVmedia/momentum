import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Film, Loader2, Circle, Square, ImagePlus, RefreshCw, MapPin, Music } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import type { PrimedCaptureGeo } from '@/react-app/utils/primeGeolocationOnUserGesture';
import type { ClipShowCandidate } from '@/shared/types';
import {
  identifyMusicWithAudD,
  auddSourceKey,
  toAudDNavPrefill,
} from '@/react-app/utils/auddIdentify';
import type { SongPrior } from '@/react-app/utils/liveSongStabilizer';
import { LiveSongStabilizer } from '@/react-app/utils/liveSongStabilizer';

/** Hard cap for in-app capture and gallery uploads (1 minute). */
const MAX_CLIP_LENGTH_SECONDS = 60;
const MAX_RECORDING_TIME = MAX_CLIP_LENGTH_SECONDS;
const HAPTIC_WARNING_TIME = 50;
/** AudD standard recognition: max ~25s per file (see docs). Keep parallel snippet under that while video can run to {@link MAX_RECORDING_TIME}. */
const MAX_AUDD_PARALLEL_RECORD_MS = 20_000;
/** Sliding-window live ID: one AudD request per timeslice; overlapping calls skipped while a request is in flight. */
const LIVE_AUDD_TIMESLICE_MS = 6000;
const MIN_LIVE_AUDD_CHUNK_BYTES = 2000;

/** Build `location.state.showData` so UploadClip prefills JamBase fields without calling resolve-show again. */
function clipCandidateToNavShowData(c: ClipShowCandidate): Record<string, unknown> {
  const out: Record<string, unknown> = {
    artist_name: c.artist_name ?? '',
    venue_name: c.venue_name ?? '',
    location: c.location ?? '',
  };
  if (c.jambase_event_id) out.jambase_event_id = c.jambase_event_id;
  if (c.jambase_artist_id) out.jambase_artist_id = c.jambase_artist_id;
  if (c.jambase_venue_id) out.jambase_venue_id = c.jambase_venue_id;
  return out;
}

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
  /** Seconds elapsed while recording (no UI; drives haptics + auto-stop). */
  const recordingSecondsRef = useRef(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProcessingTransition, setIsProcessingTransition] = useState(false);
  /** Shown on the processing overlay while AudD runs before opening the caption screen. */
  const [processingHint, setProcessingHint] = useState('');
  const [processingProgress, setProcessingProgress] = useState(8);
  const [networkSpeed, setNetworkSpeed] = useState<'fast' | 'slow' | 'offline'>('fast');
  
  // Orientation state
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [recordingOrientation, setRecordingOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [videoResolution, setVideoResolution] = useState({ width: 1080, height: 1920 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const deviceMediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Parallel audio-only recorder on cloned mic tracks (same capture window) — camera WebM often muxes audio poorly for re-extraction. */
  const auddParallelAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const auddParallelAudioChunksRef = useRef<Blob[]>([]);
  const lastParallelAuddAudioBlobRef = useRef<Blob | null>(null);
  /** Stops parallel AudD-only mic capture after MAX_AUDD_PARALLEL_RECORD_MS so the API never receives a >25s snippet. */
  const auddParallelCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveAuddRecorderRef = useRef<MediaRecorder | null>(null);
  const liveAuddInFlightRef = useRef(false);
  const liveAuddStoppedRef = useRef(true);
  const liveStabilizerRef = useRef(new LiveSongStabilizer());
  const [liveSongBanner, setLiveSongBanner] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraOpenRequested, setCameraOpenRequested] = useState(false);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua);
  const [preferredFacingMode, setPreferredFacingMode] = useState<'environment' | 'user'>('environment');
  const [audioEnabled, setAudioEnabled] = useState(true);
  /** Bound to preview <video>; drives loadedmetadata / play without mount-order deadlock */
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  /** Dedupe primed adoption within one mount; do not use MediaStream.id (often empty / unstable). */
  const lastAdoptedPrimedRef = useRef<MediaStream | null>(null);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  /** GPS used for lastGeoRef + upload `captureGeo`; JamBase tagging runs on the upload screen only. */
  const [coordsForNearbyVenues, setCoordsForNearbyVenues] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const coordsForNearbyVenuesRef = useRef<{ lat: number; lon: number } | null>(null);
  /** Successful prefetch candidate → passed as `location.state.showData` so UploadClip skips resolve-show. */
  const captureResolveCandidateRef = useRef<ClipShowCandidate | null>(null);

  /** JamBase resolve-show preview on camera (before record). */
  const [captureResolvePreview, setCaptureResolvePreview] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'none' | 'error';
    venueName: string | null;
    artistName: string | null;
    locationLine: string | null;
  }>({
    status: 'idle',
    venueName: null,
    artistName: null,
    locationLine: null,
  });

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

  // Orientation detection and handling
  useEffect(() => {
    const handleOrientationChange = () => {
      const newIsPortrait = window.innerHeight > window.innerWidth;
      setIsPortrait(newIsPortrait);
      
      // If recording is active and orientation changes, show notification
      if (isRecording && newIsPortrait !== isPortrait) {
        const currentOrientation = recordingOrientation;
        console.log(`Recording in ${currentOrientation} mode - orientation change detected`);
      }
    };

    // Listen for orientation changes
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isRecording, isPortrait, recordingOrientation]);

  // Reset capture coords when modal closes
  useEffect(() => {
    if (!showModal) {
      setCoordsForNearbyVenues(null);
      captureResolveCandidateRef.current = null;
      setCaptureResolvePreview({
        status: 'idle',
        venueName: null,
        artistName: null,
        locationLine: null,
      });
    }
  }, [showModal]);

  /** Prefetch nearest JamBase show for camera HUD (same endpoint as upload caption resolve). */
  useEffect(() => {
    if (!showModal || !user || isPending) return;
    const c = coordsForNearbyVenues;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) {
      captureResolveCandidateRef.current = null;
      setCaptureResolvePreview({
        status: 'idle',
        venueName: null,
        artistName: null,
        locationLine: null,
      });
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      captureResolveCandidateRef.current = null;
      setCaptureResolvePreview({
        status: 'loading',
        venueName: null,
        artistName: null,
        locationLine: null,
      });
      try {
        const res = await fetch('/api/clips/resolve-show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: ac.signal,
          body: JSON.stringify({
            latitude: c.lat,
            longitude: c.lon,
            at: new Date().toISOString(),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          captureResolveCandidateRef.current = null;
          setCaptureResolvePreview({
            status: 'error',
            venueName: null,
            artistName: null,
            locationLine: null,
          });
          return;
        }
        const data = (await res.json()) as {
          match?: string;
          candidates?: ClipShowCandidate[];
        };
        if (cancelled) return;
        const cand = data.match === 'single' ? data.candidates?.[0] : undefined;
        if (cand?.venue_name?.trim()) {
          captureResolveCandidateRef.current = cand;
          setCaptureResolvePreview({
            status: 'ready',
            venueName: cand.venue_name.trim(),
            artistName: cand.artist_name?.trim() ?? null,
            locationLine: cand.location?.trim() ?? null,
          });
        } else {
          captureResolveCandidateRef.current = null;
          setCaptureResolvePreview({
            status: 'none',
            venueName: null,
            artistName: null,
            locationLine: null,
          });
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
        captureResolveCandidateRef.current = null;
        setCaptureResolvePreview({
          status: 'error',
          venueName: null,
          artistName: null,
          locationLine: null,
        });
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [showModal, user, isPending, coordsForNearbyVenues?.lat, coordsForNearbyVenues?.lon]);

  // Apply GPS from the same user gesture as camera launch (parent primed); no getCurrentPosition here.
  useEffect(() => {
    if (captureLaunchGeo === undefined) return;
    if (!showModal || !captureLaunchGeoResolved) return;
    if (
      captureLaunchGeo != null &&
      Number.isFinite(captureLaunchGeo.latitude) &&
      Number.isFinite(captureLaunchGeo.longitude)
    ) {
      lastGeoRef.current = {
        latitude: captureLaunchGeo.latitude,
        longitude: captureLaunchGeo.longitude,
        accuracy: captureLaunchGeo.accuracy,
        city: null,
        state: null,
        country: null,
      };
      setCoordsForNearbyVenues({
        lat: captureLaunchGeo.latitude,
        lon: captureLaunchGeo.longitude,
      });
    }
  }, [showModal, captureLaunchGeo, captureLaunchGeoResolved]);

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
    setPreviewStream(null);
    setPermissionDenied(false); // Clear previous denial state
    setCameraError(null);

    try {
      // Detect current orientation
      const currentIsPortrait = window.innerHeight > window.innerWidth;
      console.log('QuickRecordButton: Current orientation:', currentIsPortrait ? 'portrait' : 'landscape');
      
      // Try multiple camera constraint sets for broader mobile compatibility.
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
          ? [...facingFirst, ...heavyFacing]
          : isIOS || isAndroid
            ? [...facingFirst, ...heavyFacing, true]
            : [true, ...facingFirst, ...heavyFacing];

      const audioConstraintsObj = {
        sampleRate: 48000,
        channelCount: 2,
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
          'Camera opened without microphone access. Song recognition (AudD) needs audio — allow the microphone for this site, then open Capture again.',
        );
      } else {
        setAudioEnabled(true);
        setCameraError(null);
      }
      
      return stream;
    } catch (err) {
      console.warn('QuickRecordButton: camera access failed:', err);
      setPreviewStream(null);
      const isNotAllowed =
        err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setPermissionDenied(isNotAllowed);
      const noDeviceHint =
        'No camera was detected (common without a webcam, in Docker, or when the browser cannot access devices). Use the gallery button to pick a video.';
      const fallbackMsg = isNotAllowed
        ? isIOS && isSafari
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
      return;
    }

    let cancelled = false;
    let marked = false;

    const markReady = () => {
      if (cancelled || marked) return;
      marked = true;
      void video.play().catch(() => undefined);
      setHasPermission(true);
      setCameraReady(true);
      try {
        const vt = previewStream.getVideoTracks()[0];
        if (vt?.getSettings) {
          const settings = vt.getSettings();
          if (settings.width && settings.height) {
            setVideoResolution({ width: settings.width, height: settings.height });
          }
        }
      } catch (e) {
        console.warn('QuickRecordButton: preview metadata failed', e);
      }
    };

    const tryMarkFromElement = () => {
      if (cancelled || marked) return;
      void video.play().catch(() => undefined);
      const vt = previewStream.getVideoTracks()[0];
      const streamLive = vt?.readyState === 'live';
      const hasDims = video.videoWidth > 0 && video.videoHeight > 0;
      // Safari often stays at HAVE_METADATA with 0×0 until after play(); still allow ready UI + record.
      if (
        hasDims ||
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ||
        (streamLive && video.readyState >= HTMLMediaElement.HAVE_METADATA)
      ) {
        markReady();
      }
    };

    // iOS WebKit often will not decode or advance readyState while the <video> is
    // effectively hidden (e.g. opacity:0). Keep preview opaque; the loading layer covers it.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.srcObject = previewStream;

    const onMeta = () => tryMarkFromElement();
    const onData = () => tryMarkFromElement();
    const onCanPlay = () => tryMarkFromElement();
    const onPlaying = () => markReady();

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('loadeddata', onData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlaying);

    const vTrack = previewStream.getVideoTracks()[0];
    const onTrackUnmute = () => tryMarkFromElement();
    vTrack?.addEventListener('unmute', onTrackUnmute);

    tryMarkFromElement();

    let frames = 0;
    const maxFrames = 180;
    const poll = () => {
      if (cancelled || marked) return;
      frames += 1;
      tryMarkFromElement();
      if (!marked && frames < maxFrames) {
        requestAnimationFrame(poll);
      } else if (!marked) {
        markReady();
      }
    };
    requestAnimationFrame(poll);

    // Permission resolves outside a tap; if events never fire, still unblock capture when the track is live.
    const fallbackMs = 600;
    const fallbackId = window.setTimeout(() => {
      if (cancelled || marked) return;
      const t = previewStream.getVideoTracks()[0];
      if (t?.readyState === 'live') {
        markReady();
      }
    }, fallbackMs);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackId);
      vTrack?.removeEventListener('unmute', onTrackUnmute);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('loadeddata', onData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlaying);
    };
  }, [previewStream]);

  const toggleCameraFacing = async () => {
    if (isRecording) return;
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

  const handlePickFromDevice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileIsVideo = file.type.startsWith('video/');
    if (!fileIsVideo) {
      setCameraError('Please choose a video file.');
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
      e.target.value = '';
      return;
    }

    syncLastGeoFromNearbyCoordsRef();
    const geo = lastGeoRef.current;

    setIsProcessingTransition(true);
    setProcessingHint('Identifying music before upload (~15s)…');
    try {
      const sourceKey = auddSourceKey(file);
      const auddPrefill = toAudDNavPrefill(sourceKey, await identifyMusicWithAudD(file));
      const prefetchShow = captureResolveCandidateRef.current;
      navigate({ pathname: '/upload', search: '' }, {
        state: {
          videoFile: file,
          recordingStartedAt: new Date(file.lastModified || Date.now()).toISOString(),
          captureGeo: geo
            ? {
                latitude: geo.latitude,
                longitude: geo.longitude,
                city: geo.city,
                state: geo.state,
                country: geo.country,
              }
            : null,
          auddPrefill,
          ...(prefetchShow ? { showData: clipCandidateToNavShowData(prefetchShow) } : {}),
        },
      });
      (onAfterCaptureNavigate ?? onClose)?.();
    } finally {
      setProcessingHint('');
      setIsProcessingTransition(false);
    }
  };

  const openDeviceMediaPicker = () => {
    deviceMediaInputRef.current?.click();
  };

  const clearAuddParallelCapTimer = () => {
    if (auddParallelCapTimerRef.current != null) {
      clearTimeout(auddParallelCapTimerRef.current);
      auddParallelCapTimerRef.current = null;
    }
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

  const stopLiveAuddPipeline = () => {
    liveAuddStoppedRef.current = true;
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
    liveStabilizerRef.current.reset();
    setLiveSongBanner(null);
  };

  const startRecording = async () => {
    // Only start if camera is ready
    if (!hasPermission || !streamRef.current) {
      return;
    }

    const stream = streamRef.current;

    // Capture current orientation when recording starts
    const currentOrientation = isPortrait ? 'portrait' : 'landscape';
    setRecordingOrientation(currentOrientation);

    // Get actual video resolution
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const capturedResolution = {
      width: settings.width || videoResolution.width,
      height: settings.height || videoResolution.height
    };
    setVideoResolution(capturedResolution);

    // Light haptic pulse to confirm recording started
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

    recordingStartedAtRef.current = new Date().toISOString();

    try {
      stopLiveAuddPipeline();
      liveAuddStoppedRef.current = false;
      clearAuddParallelCapTimer();
      /** Prefer VP*+Opus so the file includes an audio track for AudD; `vp9` alone often muxes video-only. */
      const recorderMimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm;codecs=h264',
        'video/webm',
      ];
      const mimeType =
        recorderMimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

      const hasAudio = stream.getAudioTracks().length > 0;
      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 3_500_000,
      };
      if (mimeType) recorderOptions.mimeType = mimeType;
      if (hasAudio) {
        recorderOptions.audioBitsPerSecond = 128_000;
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
            : mimeType || 'video/webm';
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
          const audioMime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) =>
            MediaRecorder.isTypeSupported(m),
          );
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
              ar.start(250);
              auddParallelAudioRecorderRef.current = ar;
              clearAuddParallelCapTimer();
              auddParallelCapTimerRef.current = setTimeout(() => {
                auddParallelCapTimerRef.current = null;
                const capAr = auddParallelAudioRecorderRef.current;
                if (
                  !capAr ||
                  (capAr.state !== 'recording' && capAr.state !== 'paused')
                ) {
                  return;
                }
                capAr.onstop = () => finalizeParallelAuddRecorderOnly(capAr);
                if (typeof capAr.requestData === 'function') {
                  try {
                    capAr.requestData();
                  } catch {
                    /* ignore */
                  }
                }
                capAr.stop();
              }, MAX_AUDD_PARALLEL_RECORD_MS);

              const liveIdStream = new MediaStream(liveTracks.map((t) => t.clone()));
              const liveRec = new MediaRecorder(liveIdStream, {
                mimeType: audioMime,
                audioBitsPerSecond: 96_000,
              });
              liveRec.ondataavailable = (event) => {
                if (liveAuddStoppedRef.current) return;
                if (!event.data || event.data.size < MIN_LIVE_AUDD_CHUNK_BYTES) return;
                if (!event.data.type.startsWith('audio/')) return;
                if (liveAuddInFlightRef.current) return;
                liveAuddInFlightRef.current = true;
                void (async () => {
                  try {
                    const r = await identifyMusicWithAudD(event.data);
                    if (liveAuddStoppedRef.current) return;
                    const { line } = liveStabilizerRef.current.observe(r);
                    setLiveSongBanner(line);
                  } finally {
                    liveAuddInFlightRef.current = false;
                  }
                })();
              };
              liveAuddRecorderRef.current = liveRec;
              liveRec.start(LIVE_AUDD_TIMESLICE_MS);
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
      stopLiveAuddPipeline();
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || (mr.state !== 'recording' && mr.state !== 'paused')) {
      return;
    }

    stopLiveAuddPipeline();

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
      setIsRecording(false);
      setIsProcessingTransition(true);
      setProcessingProgress(14);

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
  };

  const handleRecordingComplete = async (blob: Blob) => {
    const clearProcessingTicker = () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    };
    clearProcessingTicker();
    const targetPeak = networkSpeed === 'fast' ? 88 : 82;
    const tickMs = networkSpeed === 'fast' ? 140 : 260;
    processingIntervalRef.current = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev >= targetPeak) return prev;
        const remaining = targetPeak - prev;
        const deltaBase = networkSpeed === 'fast' ? 6 : 3;
        const delta = Math.max(1, Math.min(deltaBase, remaining / 3));
        return Math.min(targetPeak, prev + delta);
      });
    }, tickMs);

    try {
      setProcessingProgress(networkSpeed === 'fast' ? 24 : 18);
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const at = recordingStartedAtRef.current || new Date().toISOString();
      syncLastGeoFromNearbyCoordsRef();
      const geo = lastGeoRef.current;
      setProcessingProgress((prev) => Math.max(prev, networkSpeed === 'fast' ? 94 : 86));

      setProcessingHint('Identifying music before upload (~15s)…');
      const parallelAudio = lastParallelAuddAudioBlobRef.current;
      lastParallelAuddAudioBlobRef.current = null;
      const MIN_PARALLEL = 220;
      const useParallelAudD =
        parallelAudio != null &&
        parallelAudio.size >= MIN_PARALLEL &&
        parallelAudio.type.startsWith('audio/');
      const auddInput = useParallelAudD ? parallelAudio : blob;
      const sourceKey = auddSourceKey(blob);
      const auddPrefill = toAudDNavPrefill(sourceKey, await identifyMusicWithAudD(auddInput));
      setProcessingHint('');

      const prefetchShow = captureResolveCandidateRef.current;
      navigate(
        { pathname: '/upload', search: '' },
        {
          replace: true,
          state: {
            videoBlob: blob,
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
            ...(prefetchShow ? { showData: clipCandidateToNavShowData(prefetchShow) } : {}),
          },
        }
      );
      (onAfterCaptureNavigate ?? onClose)?.();
      setProcessingProgress(100);

      recordingStartedAtRef.current = null;
      lastGeoRef.current = null;

      // Close modal
      setShowModal(false);
      setHasPermission(false);
      setCameraReady(false);
      setPreviewStream(null);
      setCameraOpenRequested(false);
      recordingSecondsRef.current = 0;
    } finally {
      clearProcessingTicker();
      setProcessingHint('');
      setIsProcessingTransition(false);
      setProcessingProgress(8);
    }
  };

  const closeModal = () => {
    if (isProcessingTransition) return;

    stopLiveAuddPipeline();

    clearAuddParallelCapTimer();

    const par = auddParallelAudioRecorderRef.current;
    if (par && (par.state === 'recording' || par.state === 'paused')) {
      auddParallelAudioRecorderRef.current = null;
      try {
        par.stop();
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
    lastParallelAuddAudioBlobRef.current = null;

    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setPreviewStream(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowModal(false);
    setIsRecording(false);
    setHasPermission(false);
    setCameraReady(false);
    setCameraOpenRequested(false);
    setIsProcessingTransition(false);
    setProcessingProgress(8);
    recordingSecondsRef.current = 0;
    lastGeoRef.current = null;
    lastAdoptedPrimedRef.current = null;

    // Call onClose callback if provided
    if (onClose) {
      onClose();
    }
  };
  
  // Sync external isOpen prop with internal state
  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  // Trigger camera when modal opens (skip when parent primed stream, or while waiting for launch-time GPS)
  useEffect(() => {
    if (!autoRequestCamera) return;
    if (deferCameraUntilLaunchGeo && !captureLaunchGeoResolved) {
      return;
    }
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
  ]);

  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    };
  }, []);

  // Responsive class names based on orientation
  const modalClass = `fixed inset-0 bg-black z-50 flex flex-col transition-all duration-300 ease-in-out`;

  return (
    <>
      {/* Floating Action Button - Hidden on all screen sizes (functionality moved to MobileBottomNav) */}
      {/* <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 rounded-full shadow-2xl shadow-red-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform group hidden"
        title="Film your moment"
      >
        <Film className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
      </button> */}

      {/* Recording Modal */}
      {showModal && (
        <div className={modalClass}>
          {/* Camera View */}
          <div className="flex-1 min-h-0 relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 z-0 w-full h-full object-cover"
            />
            {(!hasPermission || !cameraReady) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                <div className="text-center space-y-4 p-6 max-w-sm">
                  <Film className="w-16 h-16 text-gray-400 mx-auto" />
                  {permissionDenied ? (
                    <>
                      <h3 className="text-xl font-bold text-white">Camera blocked</h3>
                      <p className="text-gray-400 text-sm">
                        Use your device settings to allow the camera for this site, then tap Capture again. You can also
                        use the gallery button below to choose a video.
                      </p>
                      {cameraError && <p className="text-red-400/90 text-xs mt-2">{cameraError}</p>}
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">
                        {gestureCameraPrimingPending
                          ? 'Use the camera prompt if it appears…'
                          : 'Starting camera…'}
                      </p>
                      <p className="text-cyan-200/90 text-xs mt-2 max-w-xs mx-auto">
                        Location is requested when you tap Capture (with the camera) so we can match JamBase venues to
                        your clip on the next screen.
                      </p>
                      {cameraError && <p className="text-red-400 text-xs mt-2">{cameraError}</p>}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* REC + live song ID (sliding-window AudD + hysteresis) */}
            {isRecording && (
              <div
                className="absolute z-10 flex flex-col items-start gap-2 transition-all duration-300 ease-in-out"
                style={{
                  top: isPortrait ? 'max(1rem, env(safe-area-inset-top, 1rem))' : '1rem',
                  left: '1rem',
                }}
              >
                <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 px-3 py-1 rounded-lg flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-sm font-bold">REC</span>
                </div>
                {liveSongBanner ? (
                  <div
                    className="max-w-[min(90vw,20rem)] rounded-lg border border-cyan-500/35 bg-black/55 px-3 py-1.5 backdrop-blur-md"
                    title={liveSongBanner}
                  >
                    <p className="truncate text-cyan-100 text-xs font-medium leading-snug">{liveSongBanner}</p>
                  </div>
                ) : (
                  <p className="text-white/45 text-[11px] px-0.5">Listening for music…</p>
                )}
              </div>
            )}

            {/* Processing transition before opening the upload / caption screen */}
            {isProcessingTransition && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-sm">
                <div className="w-[88%] max-w-md rounded-2xl border border-white/15 bg-black/70 p-5">
                  <div className="mb-3 flex items-center gap-2 text-white">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                    <p className="text-sm font-medium">
                      {networkSpeed === 'slow' || networkSpeed === 'offline'
                        ? 'Processing on a slower connection…'
                        : 'Processing your moment…'}
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full momentum-grad-interactive transition-all duration-200 ease-out"
                      style={{ width: `${Math.min(100, Math.round(processingProgress))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    {processingHint.trim() !== ''
                      ? processingHint
                      : networkSpeed === 'slow' || networkSpeed === 'offline'
                        ? 'Hang tight while we open your clip so you can add details and post.'
                        : 'Opening your clip — venue suggestions load on the next screen.'}
                  </p>
                </div>
              </div>
            )}

            {/* Network Warning - Responsive positioning */}
            {hasPermission && networkSpeed === 'slow' && (
              <div 
                className="absolute left-4 right-4 z-10 transition-all duration-300 ease-in-out"
                style={{
                  bottom: isPortrait 
                    ? 'max(8rem, calc(env(safe-area-inset-bottom, 1rem) + 7rem))' 
                    : '8rem'
                }}
              >
                <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/50 px-4 py-2 rounded-lg">
                  <p className="text-white text-xs">Slow connection—your clip will upload when you post</p>
                </div>
              </div>
            )}

          </div>

          {/* Controls - Responsive layout */}
          <div 
            className="bg-black/90 backdrop-blur-lg border-t border-white/10 transition-all duration-300 ease-in-out"
            style={{
              paddingTop: '1.5rem',
              paddingBottom: isPortrait 
                ? 'max(1.5rem, calc(env(safe-area-inset-bottom, 1rem) + 0.5rem))' 
                : 'max(1.5rem, calc(env(safe-area-inset-bottom, 1rem) + 0.5rem))',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem'
            }}
          >
            <input
              ref={deviceMediaInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handlePickFromDevice}
            />

            {hasPermission && cameraReady && !isRecording && !isProcessingTransition && (
              <div className="mx-auto mb-3 w-full max-w-lg px-1">
                {deferCameraUntilLaunchGeo && !captureLaunchGeoResolved && (
                  <p className="text-center text-cyan-200/90 text-xs mb-2 flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    Waiting for location permission — allow it when the browser asks so we can match venues.
                  </p>
                )}
                {coordsForNearbyVenues && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-cyan-400 mt-0.5" />
                    <div className="min-w-0 flex-1 text-left space-y-1">
                      {(captureResolvePreview.status === 'idle' ||
                        captureResolvePreview.status === 'loading') && (
                        <p className="text-gray-300 text-[11px] leading-snug flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-cyan-400" />
                          Matching nearest JamBase show at your location…
                        </p>
                      )}
                      {captureResolvePreview.status === 'ready' && (
                        <>
                          <p className="text-white text-xs font-semibold leading-snug truncate">
                            {captureResolvePreview.venueName}
                          </p>
                          {captureResolvePreview.artistName ? (
                            <p className="text-cyan-100/95 text-[11px] leading-snug flex items-start gap-1.5">
                              <Music className="w-3 h-3 shrink-0 mt-0.5 text-purple-300" />
                              <span>{captureResolvePreview.artistName}</span>
                            </p>
                          ) : null}
                          {captureResolvePreview.locationLine ? (
                            <p className="text-gray-500 text-[10px] leading-snug">
                              {captureResolvePreview.locationLine}
                            </p>
                          ) : null}
                          <p className="text-gray-500 text-[10px] leading-snug pt-0.5">
                            Saved with this clip — you can edit on the next screen after you record.
                          </p>
                        </>
                      )}
                      {captureResolvePreview.status === 'none' && (
                        <p className="text-gray-300 text-[11px] leading-snug">
                          Location saved with this clip. No JamBase show matched here yet — add venue or artist after you
                          record if needed.
                        </p>
                      )}
                      {captureResolvePreview.status === 'error' && (
                        <p className="text-gray-300 text-[11px] leading-snug">
                          Couldn&apos;t preview venue here; we&apos;ll match again right after you record.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  onClick={openDeviceMediaPicker}
                  disabled={isProcessingTransition}
                  className="w-14 h-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                  title="Choose video from your device"
                >
                  <ImagePlus className="w-6 h-6" />
                </button>
              </div>

              <div className="flex justify-center pb-0.5">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!cameraReady || isProcessingTransition}
                    className="relative group disabled:opacity-50 shrink-0"
                    title="Start capturing your moment (up to 60 seconds)"
                    style={{ minWidth: '5rem', minHeight: '5rem' }}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                      <Circle className="w-16 h-16 text-red-500 fill-red-500" />
                    </div>
                    {cameraReady && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                        <span className="text-white text-xs font-medium">Capture</span>
                      </div>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={isProcessingTransition}
                    className="relative group shrink-0"
                    title="Stop recording and save your moment"
                    style={{ minWidth: '5rem', minHeight: '5rem' }}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center">
                      <Square className="w-10 h-10 text-gray-800 fill-gray-800" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="text-white text-xs font-medium">End Moment</span>
                    </div>
                  </button>
                )}
              </div>

              <div className="flex flex-col items-end justify-end">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  disabled={isRecording || isProcessingTransition}
                  className="w-14 h-14 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                  title="Flip camera"
                >
                  <RefreshCw className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
