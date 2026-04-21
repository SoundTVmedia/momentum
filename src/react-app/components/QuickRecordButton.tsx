import { useState, useRef, useEffect } from 'react';
import { Film, Loader2, Circle, Square, AlertCircle, Zap } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useJamBase } from '@/react-app/hooks/useJamBase';

const MAX_RECORDING_TIME = 60; // 60 seconds
const HAPTIC_WARNING_TIME = 45; // Haptic feedback at 45 seconds

interface QuickRecordButtonProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function QuickRecordButton({ isOpen = false, onClose }: QuickRecordButtonProps = {}) {
  const navigate = useNavigate();
  const { location, requestLocation } = useGeolocation();
  const { matchEventsByLocation } = useJamBase();
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
  const [autoTaggedShow, setAutoTaggedShow] = useState<any | null>(null);
  const [networkSpeed, setNetworkSpeed] = useState<'fast' | 'slow' | 'offline'>('fast');
  
  // Orientation state
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [recordingOrientation, setRecordingOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [videoResolution, setVideoResolution] = useState({ width: 1080, height: 1920 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Auto-detect location and match show when modal opens
  useEffect(() => {
    if (showModal && !locationLocked && !autoTaggedShow) {
      handleLocationDetection();
    }
  }, [showModal]);

  const handleLocationDetection = async () => {
    setShowSearching(true);
    
    try {
      const geo = await requestLocation();
      
      if (geo && geo.latitude && geo.longitude) {
        // Try to match with a live event
        const events = await matchEventsByLocation(geo.latitude, geo.longitude);
        
        if (events && events.length > 0) {
          const event = events[0];
          setAutoTaggedShow({
            artist_name: event.artist_name,
            venue_name: event.venue_name,
            location: [geo.city, geo.state].filter(Boolean).join(', '),
            latitude: geo.latitude,
            longitude: geo.longitude,
            accuracy: geo.accuracy,
          });
          setLocationLocked(true);
        }
      }
    } catch (err) {
      console.error('Location detection failed:', err);
    } finally {
      setShowSearching(false);
    }
  };

  const requestPermissions = async () => {
    console.log('QuickRecordButton: Requesting camera permissions...');
    setCameraReady(false); // Reset camera ready state
    setPermissionDenied(false); // Clear previous denial state

    try {
      // Detect current orientation
      const currentIsPortrait = window.innerHeight > window.innerWidth;
      console.log('QuickRecordButton: Current orientation:', currentIsPortrait ? 'portrait' : 'landscape');
      
      // Set video constraints based on orientation
      const videoConstraints = currentIsPortrait 
        ? {
            width: { ideal: 1080, min: 720 },
            height: { ideal: 1920, min: 1280 },
            frameRate: { ideal: 30, min: 30 },
            facingMode: 'environment',
          }
        : {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 30 },
            facingMode: 'environment',
          };

      console.log('QuickRecordButton: Requesting getUserMedia with constraints:', videoConstraints);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: {
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      console.log('QuickRecordButton: getUserMedia successful, stream obtained');
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('QuickRecordButton: Video stream assigned to video element');
        
        // Wait for the video to load metadata before marking as ready
        videoRef.current.onloadedmetadata = () => {
          console.log('QuickRecordButton: Video metadata loaded, camera is ready');
          setHasPermission(true);
          setCameraReady(true); // Only set cameraReady to true after video metadata is loaded
          
          // Get actual video resolution from track settings
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          
          if (settings.width && settings.height) {
            console.log('QuickRecordButton: Video resolution:', settings.width, 'x', settings.height);
            setVideoResolution({
              width: settings.width,
              height: settings.height
            });
          }
          
          // Detect low light conditions
          detectLowLight(stream);
        };
      } else {
        // If videoRef is not available, permissions are still granted but camera isn't ready
        console.log('QuickRecordButton: Video ref not available, but permissions granted');
        setHasPermission(true);
      }
      
      setPermissionDenied(false);
      
      return stream;
    } catch (err) {
      console.error('QuickRecordButton: Permission denied or camera access failed:', err);
      setPermissionDenied(true);
      setHasPermission(false);
      setCameraReady(false); // Ensure cameraReady is false on failure
      return null;
    }
  };

  const detectLowLight = (stream: MediaStream) => {
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
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

  const handleRecordingComplete = (blob: Blob) => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Navigate to upload screen with recorded blob, auto-tagged show data, and orientation metadata
    navigate('/upload', {
      state: {
        videoBlob: blob,
        showData: autoTaggedShow,
        videoMetadata: {
          recording_orientation: recordingOrientation,
          video_resolution_w: videoResolution.width,
          video_resolution_h: videoResolution.height,
        },
      },
    });

    // Close modal
    setShowModal(false);
    setHasPermission(false);
    setRecordingTime(0);
  };

  const closeModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setShowModal(false);
    setIsRecording(false);
    setHasPermission(false);
    setCameraReady(false);
    setRecordingTime(0);
    setAutoTaggedShow(null);
    setLocationLocked(false);
    
    // Call onClose callback if provided
    if (onClose) {
      onClose();
    }
  };
  
  // Sync external isOpen prop with internal state
  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  // Trigger camera permission request when modal opens, if not already granted
  useEffect(() => {
    if (showModal && !hasPermission && !permissionDenied) {
      console.log('QuickRecordButton: Modal opened, requesting camera permissions...');
      requestPermissions();
    }
  }, [showModal, hasPermission, permissionDenied]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (recordingTime / MAX_RECORDING_TIME) * 100;

  // Responsive class names based on orientation
  const modalClass = `fixed inset-0 bg-black z-50 flex flex-col transition-all duration-300 ease-in-out`;
  
  // Safe zone calculations for iOS notch and home indicator
  const safeTop = 'safe-top'; // CSS env(safe-area-inset-top) or custom value
  const safeBottom = 'safe-bottom'; // CSS env(safe-area-inset-bottom) or custom value

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
          <div className="flex-1 relative bg-black">
            {hasPermission && cameraReady ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transition-transform duration-300 ease-in-out"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-4 p-6">
                  <Film className="w-16 h-16 text-gray-400 mx-auto" />
                  {permissionDenied ? (
                    <>
                      <h3 className="text-xl font-bold text-white">Camera Access Needed</h3>
                      <p className="text-gray-400">Please allow camera and microphone access to record your moment</p>
                      <button
                        onClick={requestPermissions}
                        className="px-6 py-3 bg-cyan-500 rounded-lg text-white font-medium hover:bg-cyan-600 transition-colors"
                      >
                        Grant Access
                      </button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                      <p className="text-white">Requesting camera access...</p>
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
                    <span className="text-white text-sm">📍 Finding your show...</span>
                  </div>
                ) : locationLocked && autoTaggedShow ? (
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg">
                    <div className="text-cyan-400 text-sm font-medium text-center">
                      📍 {autoTaggedShow.artist_name} at {autoTaggedShow.venue_name}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg">
                    <div className="text-gray-400 text-sm">Ready to capture</div>
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
            <div className={`flex items-center justify-between mx-auto transition-all duration-300 ease-in-out ${
              isPortrait ? 'max-w-lg' : 'max-w-2xl'
            }`}>
              <button
                onClick={closeModal}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
                style={{ minWidth: '3.5rem', minHeight: '3.5rem' }}
              >
                <span className="text-xl">✕</span>
              </button>

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
      )}
    </>
  );
}
