import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Film, Loader2, Circle, Square, ImagePlus, RefreshCw, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import type { ClipShowCandidate } from '@/shared/types';

/** Hard cap for in-app capture and gallery uploads (1 minute). */
const MAX_CLIP_LENGTH_SECONDS = 60;
const MAX_RECORDING_TIME = MAX_CLIP_LENGTH_SECONDS;
const HAPTIC_WARNING_TIME = 50;

interface QuickRecordButtonProps {
  isOpen?: boolean;
  onClose?: () => void;
  /** Obtained in the same user gesture as opening capture (see MobileBottomNav). Required for iOS Safari. */
  primedMediaStream?: MediaStream | null;
  /** When false, skip getUserMedia on open (primed stream or caller handles it). */
  autoRequestCamera?: boolean;
  /** Parent is resolving getUserMedia on the capture tap — wait before treating as gesture-only with no stream. */
  gestureCameraPrimingPending?: boolean;
}

export default function QuickRecordButton({
  isOpen = false,
  onClose,
  primedMediaStream = null,
  autoRequestCamera = true,
  gestureCameraPrimingPending = false,
}: QuickRecordButtonProps = {}) {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { getDeviceCoordinates } = useGeolocation();
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
  /** One automatic location read per capture session, after the live preview is ready. */
  const previewGeoRequestedRef = useRef(false);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedVenueCandidateRef = useRef<ClipShowCandidate | null>(null);
  const [coordsForNearbyVenues, setCoordsForNearbyVenues] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [nearbyVenues, setNearbyVenues] = useState<ClipShowCandidate[]>([]);
  const [nearbyVenuesLoading, setNearbyVenuesLoading] = useState(false);
  const [nearbyVenuesNotice, setNearbyVenuesNotice] = useState<string | null>(null);
  const [selectedVenueKey, setSelectedVenueKey] = useState<string | null>(null);
  const [locationRequestInFlight, setLocationRequestInFlight] = useState(false);
  const [previewGeoPending, setPreviewGeoPending] = useState(false);

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

  // Reset venue / location UI when capture closes
  useEffect(() => {
    if (!showModal) {
      previewGeoRequestedRef.current = false;
      setPreviewGeoPending(false);
      setCoordsForNearbyVenues(null);
      setNearbyVenues([]);
      setNearbyVenuesLoading(false);
      setNearbyVenuesNotice(null);
      selectedVenueCandidateRef.current = null;
      setSelectedVenueKey(null);
    }
  }, [showModal]);

  // Location only after live preview is ready (video pipeline marked ready — not just getUserMedia).
  useEffect(() => {
    if (!showModal || !hasPermission || !cameraReady) return;
    if (previewGeoRequestedRef.current) return;
    previewGeoRequestedRef.current = true;
    setPreviewGeoPending(true);
    let cancelled = false;

    void (async () => {
      try {
        const geo = await getDeviceCoordinates();
        if (cancelled || !showModalRef.current) return;
        if (geo?.latitude != null && geo.longitude != null) {
          lastGeoRef.current = {
            latitude: geo.latitude,
            longitude: geo.longitude,
            accuracy: geo.accuracy,
            city: geo.city,
            state: geo.state,
            country: geo.country,
          };
          setCoordsForNearbyVenues({ lat: geo.latitude, lon: geo.longitude });
        }
      } finally {
        if (!cancelled && showModalRef.current) {
          setPreviewGeoPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setPreviewGeoPending(false);
      previewGeoRequestedRef.current = false;
    };
  }, [showModal, hasPermission, cameraReady, getDeviceCoordinates]);

  useEffect(() => {
    if (!coordsForNearbyVenues || !user || isPending) {
      return;
    }
    const ac = new AbortController();
    setNearbyVenuesLoading(true);
    setNearbyVenuesNotice(null);
    void (async () => {
      try {
        const res = await fetch('/api/clips/resolve-show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: ac.signal,
          body: JSON.stringify({
            latitude: coordsForNearbyVenues.lat,
            longitude: coordsForNearbyVenues.lon,
            at: new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          if (!ac.signal.aborted) {
            setNearbyVenues([]);
            setNearbyVenuesNotice('Could not load nearby venues.');
          }
          return;
        }
        const data = (await res.json()) as {
          nearbyVenues?: ClipShowCandidate[];
          notice?: string | null;
        };
        if (ac.signal.aborted) return;
        const list = Array.isArray(data.nearbyVenues) ? data.nearbyVenues : [];
        setNearbyVenues(list);
        setNearbyVenuesNotice(data.notice?.trim() || null);
        selectedVenueCandidateRef.current = null;
        setSelectedVenueKey(null);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (!ac.signal.aborted) {
          setNearbyVenues([]);
          setNearbyVenuesNotice('Could not load nearby venues.');
        }
      } finally {
        if (!ac.signal.aborted) setNearbyVenuesLoading(false);
      }
    })();
    return () => ac.abort();
  }, [coordsForNearbyVenues, user, isPending]);

  const requestLocationForVenues = async () => {
    setLocationRequestInFlight(true);
    try {
      const geo = await getDeviceCoordinates();
      if (geo?.latitude == null || geo.longitude == null) return;
      lastGeoRef.current = {
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
        city: geo.city,
        state: geo.state,
        country: geo.country,
      };
      setCoordsForNearbyVenues({ lat: geo.latitude, lon: geo.longitude });
    } finally {
      setLocationRequestInFlight(false);
    }
  };

  /** Refresh GPS into lastGeoRef; keeps any city/state/country already merged from a prior read. */
  const mergeDeviceGpsIntoLastGeoRef = async () => {
    const fresh = await getDeviceCoordinates();
    if (fresh?.latitude == null || fresh.longitude == null) return;
    const prev = lastGeoRef.current;
    lastGeoRef.current = {
      latitude: fresh.latitude,
      longitude: fresh.longitude,
      accuracy: fresh.accuracy ?? prev?.accuracy,
      city: fresh.city ?? prev?.city ?? null,
      state: fresh.state ?? prev?.state ?? null,
      country: fresh.country ?? prev?.country ?? null,
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
      // Initial open: try `video: true` first on desktop; on mobile use facing hints so environment/back is reachable.
      // Flip (facingOverride set): never use `video: true` — it ignores facingMode and often re-opens the same camera,
      // so the first tap would look like a no-op until a later constraint happened to win.
      const videoAttempts: (MediaTrackConstraints | boolean)[] =
        facingOverride !== undefined
          ? [...facingFirst, ...heavyFacing]
          : [
              true,
              ...(isIOS || isAndroid ? facingFirst : []),
              ...heavyFacing,
            ];

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
        setCameraError('Camera opened without microphone access. Video capture still works.');
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

    await mergeDeviceGpsIntoLastGeoRef();
    const geo = lastGeoRef.current;
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
      },
    });
  };

  const openDeviceMediaPicker = () => {
    deviceMediaInputRef.current?.click();
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
      // Use VP9 codec if available, fallback to H.264
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
        ? 'video/webm;codecs=h264'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3500000, // 3.5 Mbps - optimized for 1080p/30fps
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        handleRecordingComplete(blob);
      };

      mediaRecorder.start(100); // Capture data every 100ms for smoother recording
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      recordingSecondsRef.current = 0;

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
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessingTransition(true);
      setProcessingProgress(14);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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

    setProcessingProgress(networkSpeed === 'fast' ? 24 : 18);
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const at = recordingStartedAtRef.current || new Date().toISOString();
    // Fresh lat/lon at end of capture (same permission) so JamBase resolve matches where the clip was recorded.
    await mergeDeviceGpsIntoLastGeoRef();
    const geo = lastGeoRef.current;
    setProcessingProgress((prev) => Math.max(prev, networkSpeed === 'fast' ? 46 : 32));

    let showData: Record<string, unknown> | null = null;
    let ambiguousCandidates: ClipShowCandidate[] | null = null;

    const picked = selectedVenueCandidateRef.current;
    if (picked && geo?.latitude != null && geo?.longitude != null) {
      showData = {
        artist_name: picked.artist_name ?? '',
        venue_name: picked.venue_name ?? '',
        location:
          (picked.location?.trim() ||
            [geo.city, geo.state].filter(Boolean).join(', ')) ||
          '',
        ...(picked.jambase_event_id ? { jambase_event_id: picked.jambase_event_id } : {}),
        ...(picked.jambase_artist_id ? { jambase_artist_id: picked.jambase_artist_id } : {}),
        ...(picked.jambase_venue_id ? { jambase_venue_id: picked.jambase_venue_id } : {}),
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy: geo.accuracy,
      };
    } else if (geo?.latitude != null && geo?.longitude != null) {
      try {
        const res = await fetch('/api/clips/resolve-show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            latitude: geo.latitude,
            longitude: geo.longitude,
            at,
            city: geo.city ?? undefined,
            state: geo.state ?? undefined,
            country: geo.country ?? undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.match === 'single' && data.candidates?.[0]) {
            const c = data.candidates[0] as ClipShowCandidate;
            showData = {
              artist_name: c.artist_name ?? '',
              venue_name: c.venue_name ?? '',
              location: c.location ?? [geo.city, geo.state].filter(Boolean).join(', '),
              ...(c.jambase_event_id ? { jambase_event_id: c.jambase_event_id } : {}),
              ...(c.jambase_artist_id ? { jambase_artist_id: c.jambase_artist_id } : {}),
              ...(c.jambase_venue_id ? { jambase_venue_id: c.jambase_venue_id } : {}),
              latitude: geo.latitude,
              longitude: geo.longitude,
              accuracy: geo.accuracy,
            };
          } else if (data.match === 'ambiguous' && data.candidates?.length) {
            ambiguousCandidates = data.candidates as ClipShowCandidate[];
          }
        }
      } catch (e) {
        console.error('resolve-show failed:', e);
      }
    }
    setProcessingProgress((prev) => Math.max(prev, networkSpeed === 'fast' ? 94 : 86));

    navigate(
      { pathname: '/upload', search: '' },
      {
        replace: true,
        state: {
          videoBlob: blob,
          showData,
          ambiguousCandidates,
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
        },
      }
    );
    setProcessingProgress(100);
    clearProcessingTicker();

    recordingStartedAtRef.current = null;
    lastGeoRef.current = null;
    previewGeoRequestedRef.current = false;
    selectedVenueCandidateRef.current = null;

    // Close modal
    setShowModal(false);
    setHasPermission(false);
    setCameraReady(false);
    setPreviewStream(null);
    setCameraOpenRequested(false);
    setIsProcessingTransition(false);
    setProcessingProgress(8);
    recordingSecondsRef.current = 0;
  };

  const closeModal = () => {
    if (isProcessingTransition) return;

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
    previewGeoRequestedRef.current = false;
    lastAdoptedPrimedRef.current = null;
    selectedVenueCandidateRef.current = null;
    setSelectedVenueKey(null);

    // Call onClose callback if provided
    if (onClose) {
      onClose();
    }
  };
  
  // Sync external isOpen prop with internal state
  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  // Trigger camera when modal opens (skip when parent primed stream on user gesture, or autoRequestCamera false)
  useEffect(() => {
    if (!autoRequestCamera) return;
    if (showModal && !permissionDenied && !cameraOpenRequested) {
      console.log('QuickRecordButton: Modal opened, requesting camera permissions...');
      void requestPermissions();
    }
  }, [showModal, permissionDenied, cameraOpenRequested, autoRequestCamera]);

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
                        Once the live preview is running, we request your location so we can match you to nearby JamBase
                        venues.
                      </p>
                      {cameraError && <p className="text-red-400 text-xs mt-2">{cameraError}</p>}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* REC Indicator - Responsive positioning */}
            {isRecording && (
              <div 
                className="absolute z-10 transition-all duration-300 ease-in-out"
                style={{
                  top: isPortrait ? 'max(1rem, env(safe-area-inset-top, 1rem))' : '1rem',
                  left: '1rem'
                }}
              >
                <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 px-3 py-1 rounded-lg flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-sm font-bold">REC</span>
                </div>
              </div>
            )}

            {/* Processing transition while resolving nearby venue before upload UI */}
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
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-200 ease-out"
                      style={{ width: `${Math.min(100, Math.round(processingProgress))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    {networkSpeed === 'slow' || networkSpeed === 'offline'
                      ? 'Hang tight while we prepare your upload and look up nearby shows.'
                      : 'Preparing upload and auto-tagging the nearby show.'}
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
                {previewGeoPending && !coordsForNearbyVenues && (
                  <p className="text-center text-cyan-200/90 text-xs mb-2 flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    Getting your location for nearby venues…
                  </p>
                )}
                {hasPermission &&
                  cameraReady &&
                  !coordsForNearbyVenues &&
                  !nearbyVenuesLoading &&
                  !previewGeoPending && (
                    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2.5 text-center mb-2">
                      <p className="text-white/90 text-xs mb-2">
                        Share approximate location so we can list JamBase venues near you.
                      </p>
                      <button
                        type="button"
                        disabled={locationRequestInFlight}
                        onClick={() => void requestLocationForVenues()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                      >
                        {locationRequestInFlight ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Requesting…
                          </>
                        ) : (
                          'Share location for venues'
                        )}
                      </button>
                    </div>
                  )}
                {(coordsForNearbyVenues || nearbyVenuesLoading) && (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                    <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-white/10">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                      <span className="text-white/90 text-xs font-medium">Nearby venues</span>
                      {nearbyVenuesLoading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 ml-auto" />
                      )}
                    </div>
                    {nearbyVenuesNotice && nearbyVenues.length === 0 && !nearbyVenuesLoading && (
                      <p className="text-amber-200/90 text-[11px] px-1 py-1.5">{nearbyVenuesNotice}</p>
                    )}
                    {!nearbyVenuesLoading && nearbyVenues.length === 0 && !nearbyVenuesNotice && coordsForNearbyVenues && (
                      <p className="text-gray-400 text-[11px] px-1 py-1.5">No venues matched this spot in your radius. You can tag the venue on the next screen.</p>
                    )}
                    {nearbyVenues.length > 0 && (
                      <ul className="mt-1 max-h-[9.5rem] overflow-y-auto space-y-0.5">
                        {nearbyVenues.map((c, idx) => {
                          const rowKey = `${c.jambase_venue_id ?? ''}:${c.jambase_event_id ?? ''}:${c.venue_name ?? ''}:${idx}`;
                          const dist =
                            c.distance_miles != null && Number.isFinite(c.distance_miles)
                              ? `${c.distance_miles.toFixed(1)} mi`
                              : 'Nearby';
                          const selected = selectedVenueKey === rowKey;
                          return (
                            <li key={rowKey}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedVenueKey === rowKey) {
                                    setSelectedVenueKey(null);
                                    selectedVenueCandidateRef.current = null;
                                  } else {
                                    setSelectedVenueKey(rowKey);
                                    selectedVenueCandidateRef.current = c;
                                  }
                                }}
                                className={`w-full text-left rounded-lg px-2 py-1.5 text-[11px] leading-snug transition-colors ${
                                  selected
                                    ? 'bg-cyan-500/25 border border-cyan-400/50 text-white'
                                    : 'hover:bg-white/10 text-white/90 border border-transparent'
                                }`}
                              >
                                <span className="font-medium text-white">{c.venue_name ?? 'Venue'}</span>
                                {c.artist_name ? (
                                  <span className="text-gray-400"> · {c.artist_name}</span>
                                ) : null}
                                <span className="block text-gray-500 mt-0.5">
                                  {c.location ?? '—'} · {dist}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {selectedVenueKey && (
                      <p className="text-cyan-300/90 text-[10px] px-1 pt-1">Selected tag is used when you finish recording.</p>
                    )}
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
