import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Film, Loader2, Circle, Square, AlertCircle, Zap, ImagePlus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import type { ClipShowCandidate } from '@/shared/types';

const MAX_RECORDING_TIME = 60; // 60 seconds
const HAPTIC_WARNING_TIME = 45; // Haptic feedback at 45 seconds

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
  const { requestLocation } = useGeolocation();
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [lowLightDetected, setLowLightDetected] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [locationLocked, setLocationLocked] = useState(false);
  const [showSearching, setShowSearching] = useState(false);
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

  // Prime device location when modal opens (JamBase match runs when recording finishes)
  useEffect(() => {
    if (showModal && !locationLocked) {
      (async () => {
        setShowSearching(true);
        try {
          const geo = await requestLocation();
          if (geo?.latitude != null && geo?.longitude != null) {
            lastGeoRef.current = geo;
            setLocationLocked(true);
          }
        } catch (err) {
          console.error('Location detection failed:', err);
        } finally {
          setShowSearching(false);
        }
      })();
    }
  }, [showModal, locationLocked, requestLocation]);

  const requestPermissions = async (facingOverride?: 'environment' | 'user') => {
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
      // `true` first: works on most desktops, VMs, and Docker dev where facingMode/heavy mins can yield NotFoundError.
      const videoAttempts: (MediaTrackConstraints | boolean)[] = [
        true,
        ...(isIOS || isAndroid
          ? [
              { facingMode: { ideal: orderedFacingModes[0] } },
              { facingMode: { ideal: orderedFacingModes[1] } },
            ]
          : []),
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
        detectLowLight(previewStream);
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
    const next = preferredFacingMode === 'environment' ? 'user' : 'environment';
    setPreferredFacingMode(next);
    await requestPermissions(next);
  };

  const handlePickFromDevice = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileIsVideo = file.type.startsWith('video/');
    if (!fileIsVideo) {
      setCameraError('Please choose a video file.');
      return;
    }

    const geo = lastGeoRef.current;
    navigate('/upload', {
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

  const detectLowLight = (stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];

    // Check if device supports flash
    const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
    const hasTorch = capabilities && 'torch' in capabilities;
    
    if (hasTorch) {
      // Simple low light detection based on brightness (would need more sophisticated detection in production)
      setLowLightDetected(true);
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: !flashEnabled } as any],
      });
      setFlashEnabled(!flashEnabled);
    } catch (err) {
      console.error('Flash toggle failed:', err);
    }
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
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          
          // Haptic feedback at 45 seconds
          if (newTime === HAPTIC_WARNING_TIME && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]); // Short vibration pattern
          }
          
          // Auto-stop at 60 seconds
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
          }
          
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording failed:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleRecordingComplete = async (blob: Blob) => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const at = recordingStartedAtRef.current || new Date().toISOString();
    let geo = lastGeoRef.current;
    if (!geo?.latitude) {
      try {
        const g = await requestLocation();
        if (g?.latitude != null && g?.longitude != null) {
          geo = g;
          lastGeoRef.current = g;
        }
      } catch {
        /* ignore */
      }
    }

    let showData: Record<string, unknown> | null = null;
    let ambiguousCandidates: ClipShowCandidate[] | null = null;

    if (geo?.latitude != null && geo?.longitude != null) {
      try {
        const res = await fetch('/api/clips/resolve-show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
              jambase_event_id: c.jambase_event_id,
              jambase_artist_id: c.jambase_artist_id,
              jambase_venue_id: c.jambase_venue_id,
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

    navigate('/upload', {
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
    });

    recordingStartedAtRef.current = null;

    // Close modal
    setShowModal(false);
    setHasPermission(false);
    setCameraReady(false);
    setPreviewStream(null);
    setCameraOpenRequested(false);
    setRecordingTime(0);
  };

  const closeModal = () => {
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
    setRecordingTime(0);
    lastGeoRef.current = null;
    setLocationLocked(false);
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

  // Trigger camera when modal opens (skip when parent primed stream on user gesture, or autoRequestCamera false)
  useEffect(() => {
    if (!autoRequestCamera) return;
    if (showModal && !permissionDenied && !cameraOpenRequested) {
      console.log('QuickRecordButton: Modal opened, requesting camera permissions...');
      void requestPermissions();
    }
  }, [showModal, permissionDenied, cameraOpenRequested, autoRequestCamera]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (recordingTime / MAX_RECORDING_TIME) * 100;

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

            {/* Location Status - Responsive positioning */}
            {hasPermission && (
              <div 
                className="absolute left-1/2 transform -translate-x-1/2 z-10 transition-all duration-300 ease-in-out max-w-[90%]"
                style={{
                  top: isPortrait ? 'max(1rem, env(safe-area-inset-top, 1rem))' : '1rem'
                }}
              >
                {showSearching ? (
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-white text-sm">📍 Getting location…</span>
                  </div>
                ) : locationLocked ? (
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg">
                    <div className="text-cyan-400 text-sm font-medium text-center">
                      📍 Location on — we will tag the show when you finish recording
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg">
                    <div className="text-gray-400 text-sm">Allow location to auto-tag nearby shows</div>
                  </div>
                )}
              </div>
            )}

            {/* Low Light Warning - Responsive positioning */}
            {hasPermission && lowLightDetected && !flashEnabled && (
              <div 
                className="absolute left-4 right-4 z-10 transition-all duration-300 ease-in-out"
                style={{
                  top: isPortrait ? 'max(5rem, calc(env(safe-area-inset-top, 1rem) + 4rem))' : '5rem'
                }}
              >
                <div className="bg-yellow-500/20 backdrop-blur-md border border-yellow-500/50 px-4 py-3 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="text-white text-sm">Dim lighting detected. Turn on flash?</span>
                  </div>
                  <button
                    onClick={toggleFlash}
                    className="px-3 py-1 bg-yellow-500 rounded-lg text-black text-sm font-medium hover:bg-yellow-400 transition-colors flex items-center space-x-1 flex-shrink-0"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Turn On Flash</span>
                  </button>
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

            {/* Timer & Progress - Responsive positioning */}
            {cameraReady && (
              <div 
                className="absolute inset-x-0 z-10 px-4 transition-all duration-300 ease-in-out"
                style={{
                  bottom: isPortrait 
                    ? 'max(8rem, calc(env(safe-area-inset-bottom, 1rem) + 7rem))' 
                    : '8rem'
                }}
              >
                <div className="bg-black/60 backdrop-blur-md rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {isRecording && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
                      <span className="text-white font-mono text-2xl font-bold">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                    {isRecording && (
                      <span className="text-gray-400 text-sm">
                        {formatTime(MAX_RECORDING_TIME - recordingTime)} left
                      </span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        isRecording 
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500' 
                          : 'bg-gray-500'
                      }`}
                      style={{ width: `${isRecording ? progressPercentage : 0}%` }}
                    />
                  </div>
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
            <div className={`flex items-center justify-between mx-auto transition-all duration-300 ease-in-out ${
              isPortrait ? 'max-w-lg' : 'max-w-2xl'
            }`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                >
                  <span className="text-xl">✕</span>
                </button>
                <button
                  onClick={openDeviceMediaPicker}
                  className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                  title="Choose video from your device"
                >
                  <ImagePlus className="w-6 h-6" />
                </button>
              </div>

              {/* Main Action Button - Responsive sizing */}
              {!isRecording ? (
                /* Ready State - Capture Button */
                <button
                  onClick={startRecording}
                  disabled={!cameraReady}
                  className="relative group disabled:opacity-50 flex-shrink-0"
                  title="Start capturing your moment (up to 60 seconds)"
                  style={{ minWidth: '5rem', minHeight: '5rem' }}
                >
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <Circle className="w-16 h-16 text-red-500 fill-red-500" />
                  </div>
                  {cameraReady && (
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                      <span className="text-white text-xs font-medium">Capture</span>
                    </div>
                  )}
                </button>
              ) : (
                /* Recording State - End Moment Button */
                <button
                  onClick={stopRecording}
                  className="relative group flex-shrink-0"
                  title="Stop recording and save your moment"
                  style={{ minWidth: '5rem', minHeight: '5rem' }}
                >
                  <div className="w-20 h-20 rounded-full bg-white/80 flex items-center justify-center">
                    <Square className="w-10 h-10 text-gray-800 fill-gray-800" />
                  </div>
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                    <span className="text-white text-xs font-medium">End Moment</span>
                  </div>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleCameraFacing}
                  disabled={isRecording}
                  className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0 disabled:opacity-50"
                  style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                  title="Flip camera"
                >
                  <RefreshCw className="w-6 h-6" />
                </button>
                <span className="text-[10px] text-gray-300 leading-none">
                  {preferredFacingMode === 'environment' ? 'Back' : 'Front'}
                </span>
                {flashEnabled ? (
                  <button
                    onClick={toggleFlash}
                    className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 hover:bg-yellow-500/30 transition-colors flex-shrink-0"
                    style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
                  >
                    <Zap className="w-6 h-6 fill-yellow-400" />
                  </button>
                ) : (
                  <div className="w-14 h-14 flex-shrink-0" style={{ minWidth: '3.5rem' }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
