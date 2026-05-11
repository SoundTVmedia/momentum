import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Upload, MapPin, Music, Calendar, Hash, Loader2, X, Film, Image as ImageIcon, Search, Edit2, Check, Share2, Heart, MessageCircle, Bookmark } from 'lucide-react';
import Header from '@/react-app/components/Header';
import QuickRecordButton from '@/react-app/components/QuickRecordButton';
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';
import { clipDisplayAspectRatio } from '@/react-app/utils/clipDisplayAspectRatio';
import type { JamBaseArtist, JamBaseVenue, ClipShowCandidate } from '@/shared/types';

export default function UploadClip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPending } = useAuth();
  const { searchArtists, searchVenues, loading: jambaseLoading } = useJamBase();
  const { requestLocation } = useGeolocation();
  const { setHideBottomNav } = useMobileChrome();
  const [loading, setLoading] = useState(false);
  const [geoDetected, setGeoDetected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ video: 0, thumbnail: 0 });
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  /** Post-capture review (Share your moment) — open immediately when landing with a recorded blob/file. */
  const [showCaptionScreen, setShowCaptionScreen] = useState(() => {
    const s = location.state as { videoBlob?: unknown; videoFile?: unknown } | null | undefined;
    return Boolean(s?.videoBlob ?? s?.videoFile);
  });

  // Caption / review screen video preview (must not live inside `if (showCaptionScreen)` — Rules of Hooks)
  const captionVideoRef = useRef<HTMLVideoElement>(null);
  const [captionVideoPlaying, setCaptionVideoPlaying] = useState(false);
  const [captionVideoMuted, setCaptionVideoMuted] = useState(true);

  // Quick capture modal state
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [reRecordPrimedStream, setReRecordPrimedStream] = useState<MediaStream | null>(null);
  const [reRecordGesturePending, setReRecordGesturePending] = useState(false);

  const [isEditingTags, setIsEditingTags] = useState(false);

  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [postedClip, setPostedClip] = useState<any | null>(null);

  const [jambaseLink, setJambaseLink] = useState<{
    event: string | null;
    artist: string | null;
    venue: string | null;
  } | null>(null);
  const [ambiguousCandidates, setAmbiguousCandidates] = useState<ClipShowCandidate[]>([]);
  const [recordingAtIso, setRecordingAtIso] = useState<string | null>(null);
  const [captureGeo, setCaptureGeo] = useState<{
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null>(null);
  const [resolveNotice, setResolveNotice] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    video_file: null as File | null,
    video_blob: null as Blob | null,
    thumbnail_file: null as File | null,
    video_url: '',
    thumbnail_url: '',
    artist_name: '',
    venue_name: '',
    location: '',
    content_description: '',
    hashtags: '',
  });

  // Video metadata from QuickRecord
  const [videoMetadata, setVideoMetadata] = useState<{
    recording_orientation?: 'portrait' | 'landscape';
    video_resolution_w?: number;
    video_resolution_h?: number;
  }>({});

  useEffect(() => {
    const source = formData.video_file ?? formData.video_blob;
    if (!source) return;
    if (formData.thumbnail_file) return;

    let cancelled = false;
    void (async () => {
      const thumb = await generateVideoThumbnailJpeg(source);
      if (cancelled || !thumb) return;
      setFormData((prev) => {
        if (prev.thumbnail_file) return prev;
        if (!(prev.video_file ?? prev.video_blob)) return prev;
        return { ...prev, thumbnail_file: thumb };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.video_file, formData.video_blob, formData.thumbnail_file]);

  useEffect(() => {
    setHideBottomNav(showCaptionScreen);
    return () => setHideBottomNav(false);
  }, [showCaptionScreen, setHideBottomNav]);

  // Open quick capture when ?quickCapture=true — only for signed-in users (guests → auth, no camera)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantCapture = params.get('quickCapture') === 'true';
    if (!wantCapture) {
      setShowQuickCapture(false);
      return;
    }
    // Post-record review / caption flow must not lose to this effect (would flash the camera again).
    if (showCaptionScreen) {
      setShowQuickCapture(false);
      return;
    }
    if (isPending) return;
    if (!user) {
      setShowQuickCapture(false);
      navigate('/auth', { replace: true });
      return;
    }
    setShowQuickCapture(true);
  }, [location.search, showCaptionScreen, user, isPending, navigate]);

  // Check if we received a recorded video blob from QuickRecord
  useEffect(() => {
    if (location.state?.videoBlob) {
      const blob = location.state.videoBlob as Blob;
      setFormData(prev => ({ ...prev, video_blob: blob }));
      setUploadMethod('file');
      
      // Create blob URL for video preview
      const blobUrl = URL.createObjectURL(blob);
      setVideoBlobUrl(blobUrl);
      setShowCaptionScreen(true);
      // Recording finished — close capture overlay and release primed stream
      setShowQuickCapture(false);
      setReRecordPrimedStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
      setReRecordGesturePending(false);
    }
    if (location.state?.videoFile) {
      const selectedFile = location.state.videoFile as File;
      setFormData(prev => ({ ...prev, video_file: selectedFile, video_blob: null }));
      setUploadMethod('file');
      const fileUrl = URL.createObjectURL(selectedFile);
      setVideoBlobUrl(fileUrl);
      setShowCaptionScreen(true);
      setShowQuickCapture(false);
      setReRecordPrimedStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
      setReRecordGesturePending(false);
    }
    
    // Check if we received show data from auto-tagging
    if (location.state?.showData) {
      const showData = location.state.showData as Record<string, unknown>;
      const cap = location.state.captureGeo as
        | { city?: string | null; state?: string | null }
        | undefined;
      const fromGeo = cap ? [cap.city, cap.state].filter(Boolean).join(', ') : '';
      const locFromShow =
        typeof showData.location === 'string' && showData.location.trim() !== ''
          ? (showData.location as string)
          : fromGeo || '';

      setFormData(prev => ({
        ...prev,
        artist_name: (showData.artist_name as string) || '',
        venue_name: (showData.venue_name as string) || '',
        location: locFromShow,
      }));

      if (showData.artist_name) setArtistSearch(String(showData.artist_name));
      if (showData.venue_name) setVenueSearch(String(showData.venue_name));

      if (typeof showData.jambase_event_id === 'string') {
        setJambaseLink({
          event: showData.jambase_event_id,
          artist: typeof showData.jambase_artist_id === 'string' ? showData.jambase_artist_id : null,
          venue: typeof showData.jambase_venue_id === 'string' ? showData.jambase_venue_id : null,
        });
      } else if (typeof showData.jambase_venue_id === 'string') {
        setJambaseLink({
          event: null,
          artist: typeof showData.jambase_artist_id === 'string' ? showData.jambase_artist_id : null,
          venue: showData.jambase_venue_id,
        });
      }
      setResolveNotice(null);
    }

    const nav = location.state as Record<string, unknown> | undefined;
    if (Array.isArray(nav?.ambiguousCandidates) && nav.ambiguousCandidates.length > 0) {
      setAmbiguousCandidates(nav.ambiguousCandidates as ClipShowCandidate[]);
      setResolveNotice('We found multiple nearby venues. Pick the right one below or edit manually.');
    }
    if (typeof nav?.recordingStartedAt === 'string') {
      setRecordingAtIso(nav.recordingStartedAt);
    }
    if (nav?.captureGeo && typeof nav.captureGeo === 'object' && nav.captureGeo !== null) {
      const cg = nav.captureGeo as {
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
        country: string | null;
      };
      setCaptureGeo(cg);
      if (!nav?.showData) {
        const geoLine = [cg.city, cg.state].filter(Boolean).join(', ');
        if (geoLine) {
          setFormData((prev) => ({
            ...prev,
            location: prev.location?.trim() ? prev.location : geoLine,
          }));
        }
      }
    }
    
    // Check if we received video metadata (orientation and resolution)
    if (location.state?.videoMetadata) {
      const metadata = location.state.videoMetadata as any;
      setVideoMetadata({
        recording_orientation: metadata.recording_orientation,
        video_resolution_w: metadata.video_resolution_w,
        video_resolution_h: metadata.video_resolution_h,
      });
    }
    
    // Cleanup blob URL on unmount
    return () => {
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [location.state]);
  
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  
  // Artist autocomplete
  const [artistSearch, setArtistSearch] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState<JamBaseArtist[]>([]);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const debouncedArtistSearch = useDebounce(artistSearch, 300);
  
  // Venue autocomplete
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState<JamBaseVenue[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  // Auto-detect location on mount
  useEffect(() => {
    if (!geoDetected && user && !showCaptionScreen) {
      requestLocation().then((geo) => {
        if (geo) {
          const locationStr = [geo.city, geo.state].filter(Boolean).join(', ');
          if (locationStr) {
            setFormData(prev => ({ ...prev, location: locationStr }));
          }
          setGeoDetected(true);
        }
      });
    }
  }, [user, geoDetected, requestLocation, showCaptionScreen]);

  // Search for artists
  useEffect(() => {
    if (debouncedArtistSearch && debouncedArtistSearch.length >= 2) {
      searchArtists(debouncedArtistSearch).then(results => {
        setArtistSuggestions(results);
        setShowArtistSuggestions(results.length > 0);
      });
    } else {
      setArtistSuggestions([]);
      setShowArtistSuggestions(false);
    }
  }, [debouncedArtistSearch, searchArtists]);

  // Search for venues
  useEffect(() => {
    if (debouncedVenueSearch && debouncedVenueSearch.length >= 2) {
      searchVenues(debouncedVenueSearch, formData.location).then(results => {
        setVenueSuggestions(results);
        setShowVenueSuggestions(results.length > 0);
      });
    } else {
      setVenueSuggestions([]);
      setShowVenueSuggestions(false);
    }
  }, [debouncedVenueSearch, formData.location, searchVenues]);

  const applyClipCandidate = useCallback((c: ClipShowCandidate) => {
    setFormData((prev) => ({
      ...prev,
      artist_name: c.artist_name ?? '',
      venue_name: c.venue_name ?? '',
      location: c.location ?? prev.location,
    }));
    setArtistSearch(c.artist_name ?? '');
    setVenueSearch(c.venue_name ?? '');
    setJambaseLink({
      event: c.jambase_event_id ?? null,
      artist: c.jambase_artist_id,
      venue: c.jambase_venue_id,
    });
    setAmbiguousCandidates([]);
    setResolveNotice(null);
  }, []);

  useEffect(() => {
    if (
      formData.video_file &&
      !(location.state as { recordingStartedAt?: string } | null)?.recordingStartedAt
    ) {
      setRecordingAtIso(new Date(formData.video_file.lastModified).toISOString());
    }
  }, [formData.video_file, location.state]);

  useEffect(() => {
    if (!user) return;
    if (jambaseLink?.event || jambaseLink?.venue) return;
    if (ambiguousCandidates.length > 0) return;

    const nav = location.state as {
      videoBlob?: unknown;
      showData?: { jambase_event_id?: string; jambase_venue_id?: string };
      ambiguousCandidates?: unknown[];
      recordingStartedAt?: string;
      captureGeo?: {
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
        country: string | null;
      };
    } | null;

    const fromQuick = Boolean(nav?.videoBlob);

    const shouldResolve =
      Boolean(formData.video_file && uploadMethod === 'file' && !fromQuick) ||
      Boolean(
        showCaptionScreen &&
          fromQuick &&
          !nav?.showData &&
          !(Array.isArray(nav?.ambiguousCandidates) && nav.ambiguousCandidates.length > 0)
      );

    if (!shouldResolve) return;

    const at =
      recordingAtIso ||
      (formData.video_file ? new Date(formData.video_file.lastModified).toISOString() : null) ||
      (typeof nav?.recordingStartedAt === 'string' ? nav.recordingStartedAt : null) ||
      new Date().toISOString();

    let cancelled = false;
    (async () => {
      let geo = captureGeo;
      if (!geo?.latitude && nav?.captureGeo?.latitude != null) {
        geo = nav.captureGeo;
        if (!cancelled) setCaptureGeo(geo);
      }
      if (!geo?.latitude) {
        const g = await requestLocation();
        if (cancelled) return;
        if (g?.latitude != null && g?.longitude != null) {
          geo = {
            latitude: g.latitude,
            longitude: g.longitude,
            city: g.city,
            state: g.state,
            country: g.country,
          };
          setCaptureGeo(geo);
        } else {
          setResolveNotice('Location permission was denied, so show tagging is disabled. You can enter details manually.');
        }
      }
      if (!geo?.latitude || cancelled) return;
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
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          match?: string;
          candidates?: ClipShowCandidate[];
          notice?: string;
        };
        if (cancelled) return;
        if (data.match === 'single' && data.candidates?.[0]) {
          applyClipCandidate(data.candidates[0]);
          setResolveNotice(null);
        } else if (data.match === 'ambiguous' && data.candidates?.length) {
          setAmbiguousCandidates(data.candidates);
          setResolveNotice(
            data.notice ?? 'We found multiple nearby venues. Pick the right one below or edit manually.'
          );
        } else if (data.match === 'none') {
          setResolveNotice(
            data.notice ??
              'No nearby JamBase venue found in your radius. You can enter details manually.'
          );
        }
      } catch (e) {
        console.error('resolve-show', e);
        setResolveNotice('Auto-tagging is temporarily unavailable. You can still enter details manually.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user,
    jambaseLink?.event,
    jambaseLink?.venue,
    ambiguousCandidates.length,
    formData.video_file,
    uploadMethod,
    showCaptionScreen,
    recordingAtIso,
    captureGeo,
    location.state,
    requestLocation,
    applyClipCandidate,
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArtistSelect = (artist: JamBaseArtist) => {
    setFormData(prev => ({ ...prev, artist_name: artist.name }));
    setArtistSearch(artist.name);
    setShowArtistSuggestions(false);
  };

  const handleVenueSelect = (venue: JamBaseVenue) => {
    const venueName = venue.name;
    const venueLocation = venue.location?.city 
      ? `${venue.location.city}, ${venue.location.state || venue.location.country || ''}`
      : '';
    
    setFormData(prev => ({ 
      ...prev, 
      venue_name: venueName,
      location: venueLocation || prev.location
    }));
    setVenueSearch(venueName);
    setShowVenueSuggestions(false);
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('Video file must be less than 500MB');
      return;
    }
    const maxSeconds = 60;
    const tooLong = await new Promise<boolean>((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      const finish = (long: boolean) => {
        URL.revokeObjectURL(url);
        resolve(long);
      };
      video.onloadedmetadata = () => {
        const d = video.duration;
        finish(Number.isFinite(d) && d > maxSeconds + 1);
      };
      video.onerror = () => finish(false);
      video.src = url;
    });
    if (tooLong) {
      setError('Videos must be 1 minute or shorter.');
      e.target.value = '';
      return;
    }
    setFormData((prev) => ({ ...prev, video_file: file }));
    setError(null);
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Thumbnail file must be less than 10MB');
        return;
      }
      setFormData(prev => ({ ...prev, thumbnail_file: file }));
      setError(null);
    }
  };

  const uploadFile = async (file: File, type: 'video' | 'thumbnail'): Promise<any> => {
    const formDataToSend = new FormData();
    formDataToSend.append('file', file);
    formDataToSend.append('type', type);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formDataToSend,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${type}`);
    }

    const data = await response.json();
    return data;
  };

  const uploadVideoFromUrl = async (videoUrl: string): Promise<any> => {
    const response = await fetch('/api/stream/upload-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        name: formData.artist_name || 'Concert Clip'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to upload video from URL');
    }

    const data = await response.json();
    return data;
  };

  const handleSubmit = async (e: React.FormEvent | null, status: 'published' | 'draft' = 'published') => {
    if (e) e.preventDefault();
    
    if (uploadMethod === 'file' && !formData.video_file && !formData.video_blob) {
      setError('Please select a video file');
      return;
    }
    
    if (uploadMethod === 'url' && !formData.video_url) {
      setError('Video URL is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let videoData: any = null;
      let thumbnailUrl = formData.thumbnail_url;
      let thumbnailFile = formData.thumbnail_file;

      // Upload video - prioritize Cloudflare Stream for better quality
      if (uploadMethod === 'file' && (formData.video_file || formData.video_blob)) {
        setUploadProgress(prev => ({ ...prev, video: 10 }));
        
        // Convert blob to file if needed
        let fileToUpload = formData.video_file;
        if (!fileToUpload && formData.video_blob) {
          fileToUpload = new File([formData.video_blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
        }

        if (fileToUpload && !thumbnailFile) {
          thumbnailFile = await generateVideoThumbnailJpeg(fileToUpload, { seekSeconds: 0 });
          if (thumbnailFile) {
            setFormData((prev) => ({ ...prev, thumbnail_file: thumbnailFile }));
          }
        }
        
        if (fileToUpload) {
          videoData = await uploadFile(fileToUpload, 'video');
        }
        setUploadProgress(prev => ({ ...prev, video: 100 }));
      } else if (uploadMethod === 'url' && formData.video_url) {
        setUploadProgress(prev => ({ ...prev, video: 10 }));
        videoData = await uploadVideoFromUrl(formData.video_url);
        setUploadProgress(prev => ({ ...prev, video: 100 }));
      }

      // Upload thumbnail if provided or generated from first frame
      if (thumbnailFile) {
        setUploadProgress(prev => ({ ...prev, thumbnail: 10 }));
        const thumbData = await uploadFile(thumbnailFile, 'thumbnail');
        thumbnailUrl = thumbData.url;
        setUploadProgress(prev => ({ ...prev, thumbnail: 100 }));
      }

      const hashtagsArray = formData.hashtags
        .split(/\s+/)
        .filter(tag => tag.startsWith('#'))
        .map(tag => tag.slice(1));

      // Prepare clip data based on upload type (Stream or R2)
      const clipData: any = {
        artist_name: formData.artist_name || null,
        venue_name: formData.venue_name || null,
        location: formData.location || null,
        content_description: formData.content_description || null,
        hashtags: hashtagsArray,
        status,
        timestamp: recordingAtIso || undefined,
        jambase_event_id: jambaseLink?.event ?? undefined,
        jambase_artist_id: jambaseLink?.artist ?? undefined,
        jambase_venue_id: jambaseLink?.venue ?? undefined,
        geolocation_latitude: captureGeo?.latitude,
        geolocation_longitude: captureGeo?.longitude,
        // Include video metadata if available (orientation and resolution)
        recording_orientation: videoMetadata.recording_orientation || null,
        video_resolution_w: videoMetadata.video_resolution_w || null,
        video_resolution_h: videoMetadata.video_resolution_h || null,
      };

      // Use Stream data if available, otherwise use direct URL
      if (videoData?.type === 'stream') {
        clipData.stream_video_id = videoData.streamVideoId;
        clipData.stream_playback_url = videoData.playbackUrl;
        clipData.stream_thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
        clipData.video_status = videoData.status;
        clipData.video_duration = videoData.duration;
        clipData.video_url = videoData.playbackUrl; // Fallback for compatibility
        clipData.thumbnail_url = thumbnailUrl || videoData.thumbnailUrl;
      } else {
        clipData.video_url = videoData?.url || formData.video_url;
        clipData.thumbnail_url = thumbnailUrl || null;
      }

      const response = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clipData),
      });

      if (!response.ok) {
        let msg = 'Failed to create clip';
        try {
          const errBody = (await response.json()) as { error?: string; message?: string };
          if (typeof errBody?.error === 'string') msg = errBody.error;
          else if (typeof errBody?.message === 'string') msg = errBody.message;
        } catch {
          /* non-JSON body */
        }
        throw new Error(msg);
      }

      const newClip = await response.json();

      // Clean up blob URL if it exists
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(null);
      }

      // Navigate based on status
      if (status === 'draft') {
        navigate('/dashboard');
      } else {
        // Show confirmation modal for published clips
        setPostedClip(newClip ?? {
          artist_name: formData.artist_name || null,
          venue_name: formData.venue_name || null,
          location: formData.location || null,
          content_description: formData.content_description || null,
          thumbnail_url: thumbnailUrl || null,
        });
        setShowConfirmationModal(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload clip');
    } finally {
      setLoading(false);
      setUploadProgress({ video: 0, thumbnail: 0 });
    }
  };

  const handleSaveAsDraft = async () => {
    await handleSubmit(null, 'draft');
  };

  const handleReRecord = () => {
    // Prime camera inside the user gesture so iOS Safari allows getUserMedia without a prompt.
    const streamPromise = primeCameraOnUserGesture();
    setReRecordGesturePending(true);
    setReRecordPrimedStream(null);
    void streamPromise
      .then((stream) => setReRecordPrimedStream(stream))
      .catch(() => setReRecordPrimedStream(null))
      .finally(() => setReRecordGesturePending(false));

    // Reset upload state
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(null);
    setShowCaptionScreen(false);
    setFormData((prev) => ({ ...prev, video_blob: null, video_file: null }));
    setAmbiguousCandidates([]);
    setJambaseLink(null);
    setResolveNotice(null);
    setRecordingAtIso(null);
    setCaptureGeo(null);
    setError(null);
    // Open the capture UI in-place (no navigation — preserves user-gesture chain for camera)
    setShowQuickCapture(true);
  };

  /** Leave upload (e.g. mobile caption screen) and return to the feed; drops in-progress media. */
  const handleCloseUploadToFeed = () => {
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    setShowCaptionScreen(false);
    setFormData((prev) => ({
      ...prev,
      video_blob: null,
      video_file: null,
      thumbnail_file: null,
      video_url: '',
      thumbnail_url: '',
    }));
    setVideoMetadata({});
    setAmbiguousCandidates([]);
    setJambaseLink(null);
    setResolveNotice(null);
    setRecordingAtIso(null);
    setCaptureGeo(null);
    setError(null);
    setCaptionVideoPlaying(false);
    setCaptionVideoMuted(true);
    navigate('/feed', { replace: true });
  };

  const handleBackToFeed = () => {
    setShowConfirmationModal(false);
    setPostedClip(null);
    navigate('/feed', { replace: true });
  };

  const handleCloseSuccessModal = () => {
    setShowConfirmationModal(false);
    setPostedClip(null);
    navigate('/dashboard');
  };

  const toggleCaptionVideoPlay = () => {
    const video = captionVideoRef.current;
    if (!video) return;
    if (captionVideoPlaying) {
      video.pause();
    } else {
      void video.play();
    }
    setCaptionVideoPlaying(!captionVideoPlaying);
  };

  const toggleCaptionVideoMute = () => {
    const video = captionVideoRef.current;
    if (!video) return;
    video.muted = !captionVideoMuted;
    setCaptionVideoMuted(!captionVideoMuted);
  };

  // Reset inline preview when opening review or swapping blob URL
  useEffect(() => {
    if (!showCaptionScreen || !videoBlobUrl) return;
    setCaptionVideoPlaying(false);
    setCaptionVideoMuted(true);
    const v = captionVideoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
      v.muted = true;
    }
  }, [showCaptionScreen, videoBlobUrl]);

  const handleShareClip = async () => {
    if (!postedClip) return;

    const clipUrl = `${window.location.origin}/?clip=${postedClip.id}`;
    const shareText = `Check out this moment${postedClip.artist_name ? ` from ${postedClip.artist_name}` : ''}${postedClip.venue_name ? ` at ${postedClip.venue_name}` : ''} on FEEDBACK!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my FEEDBACK clip!',
          text: shareText,
          url: clipUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(clipUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const modalClip = postedClip ?? {
    artist_name: formData.artist_name || null,
    venue_name: formData.venue_name || null,
    location: formData.location || null,
    content_description: formData.content_description || null,
    thumbnail_url: formData.thumbnail_url || null,
  };

  const confirmationModal = showConfirmationModal ? (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-2xl w-full bg-gradient-to-b from-slate-900 to-black border border-cyan-500/20 rounded-xl overflow-hidden animate-scale-in relative">
        <button
          type="button"
          onClick={handleCloseSuccessModal}
          className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors"
          aria-label="Close success message"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="p-6 text-center border-b border-white/10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Upload complete! 🎬
          </h1>
          <p className="text-gray-300 text-lg">
            Your clip is live in the Feedback feed
          </p>
        </div>

        {/* Clip Preview */}
        <div className="p-6 bg-black/40">
          <div className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            {/* User Info */}
            <div className="p-4 flex items-center space-x-3">
              <img
                src={user?.google_user_data.picture || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=40&h=40&fit=crop&crop=face'}
                alt="Your avatar"
                className="w-10 h-10 rounded-full border-2 border-cyan-500/40"
              />
              <div>
                <div className="font-bold text-white">{user?.google_user_data.name || 'You'}</div>
                <div className="text-xs text-gray-400">just now</div>
              </div>
            </div>

            {/* Video Preview */}
            <div
              className="relative w-full max-h-[70vh] mx-auto bg-black"
              style={{
                aspectRatio: clipDisplayAspectRatio(videoMetadata) ?? '16 / 9',
              }}
            >
              {videoBlobUrl ? (
                <video
                  src={videoBlobUrl}
                  loop
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : modalClip.thumbnail_url ? (
                <img
                  src={modalClip.thumbnail_url}
                  alt="Clip thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film className="w-16 h-16 text-gray-600" />
                </div>
              )}

              {/* Overlay info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                {modalClip.artist_name && (
                  <div className="flex items-center space-x-2 text-white">
                    <Music className="w-4 h-4 text-purple-400" />
                    <span className="font-bold">{modalClip.artist_name}</span>
                  </div>
                )}
                {modalClip.venue_name && (
                  <div className="flex items-center space-x-2 text-white/90">
                    <MapPin className="w-4 h-4 text-green-400" />
                    <span>{modalClip.venue_name}</span>
                    {modalClip.location && <span className="text-white/70">• {modalClip.location}</span>}
                  </div>
                )}
                {modalClip.content_description && (
                  <p className="text-white text-sm">{modalClip.content_description}</p>
                )}
              </div>
            </div>

            {/* Engagement Buttons */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/40">
              <div className="flex items-center space-x-4">
                <button className="flex flex-col items-center space-y-1 text-gray-400">
                  <Heart className="w-6 h-6" />
                  <span className="text-xs font-bold">0</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-gray-400">
                  <MessageCircle className="w-6 h-6" />
                  <span className="text-xs font-bold">0</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-gray-400">
                  <Share2 className="w-6 h-6" />
                  <span className="text-xs font-bold">Share</span>
                </button>
                <button className="flex flex-col items-center space-y-1 text-gray-400">
                  <Bookmark className="w-6 h-6" />
                  <span className="text-xs font-bold">Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-3">
          {/* Primary CTA */}
          <button
            onClick={handleBackToFeed}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-white text-lg hover:scale-[1.02] transition-transform shadow-lg shadow-green-500/30"
          >
            Back to Feed
          </button>

          {/* Secondary CTA */}
          <button
            onClick={handleShareClip}
            className="w-full flex items-center justify-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors py-2 text-sm font-medium"
          >
            <Share2 className="w-4 h-4" />
            <span>Share with Friends</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (isPending) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }
  
  // Show quick capture modal if requested
  if (showQuickCapture) {
    return (
      <div className="min-h-screen bg-black">
        <QuickRecordButton
          isOpen={true}
          primedMediaStream={reRecordPrimedStream}
          gestureCameraPrimingPending={reRecordGesturePending}
          onClose={() => {
            reRecordPrimedStream?.getTracks().forEach((t) => t.stop());
            setReRecordPrimedStream(null);
            setReRecordGesturePending(false);
            setShowQuickCapture(false);
            window.history.replaceState({}, '', '/upload');
          }}
        />
      </div>
    );
  }

  // CAPTION SCREEN — post-capture review (same post flow as full "Share your moment" via handleSubmit)
  if (showCaptionScreen) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
        <Header />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">Share your moment</h1>
              <p className="text-gray-300 text-sm sm:text-lg">
                Add details and post — same upload as Share your moment. Venue and location are filled from your GPS
                and JamBase when we find a match; edit below if needed.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseUploadToFeed}
              className="shrink-0 flex items-center justify-center p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95 transition-transform"
              aria-label="Close and go to feed"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden">
            {/* Video Preview with Controls */}
            <div className="relative aspect-video bg-black group">
              {videoBlobUrl && (
                <>
                  <video
                    ref={captionVideoRef}
                    src={videoBlobUrl}
                    loop
                    muted={captionVideoMuted}
                    playsInline
                    className="w-full h-full object-cover"
                    onClick={toggleCaptionVideoPlay}
                  />
                  
                  {/* Video Controls Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Center Play/Pause Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={toggleCaptionVideoPlay}
                        className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        {captionVideoPlaying ? (
                          <div className="w-6 h-6 flex items-center justify-center">
                            <div className="flex space-x-1">
                              <div className="w-2 h-6 bg-white rounded-sm"></div>
                              <div className="w-2 h-6 bg-white rounded-sm"></div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-0 h-0 border-l-[20px] border-l-white border-y-[12px] border-y-transparent ml-1"></div>
                        )}
                      </button>
                    </div>

                    {/* Bottom Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={toggleCaptionVideoMute}
                          className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          {captionVideoMuted ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>
                      </div>

                      <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full">
                        <span className="text-white text-sm font-medium">
                          {videoMetadata.recording_orientation === 'portrait' ? '📱 Portrait' : '🖥️ Landscape'}
                          {videoMetadata.video_resolution_w && videoMetadata.video_resolution_h && (
                            <span className="ml-2 text-gray-300">
                              {videoMetadata.video_resolution_w}×{videoMetadata.video_resolution_h}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-400">{error}</p>
                </div>
              )}
              {resolveNotice && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-200 text-sm">{resolveNotice}</p>
                </div>
              )}

              {/* Venue & location (auto from capture / JamBase; editable via Change Artist/Venue) */}
              <div className="rounded-lg border border-white/15 bg-white/[0.06] p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
                  Venue and location
                </div>
                <div className="flex items-start gap-2 text-white">
                  <MapPin className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{formData.venue_name || 'Venue not set yet'}</p>
                    <p className="text-sm text-gray-300 break-words">
                      {formData.location || 'Location will appear from your GPS or after you pick a show.'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Filled automatically when we match your recording to a nearby venue. Use &quot;Change Artist/Venue&quot;
                  below to edit.
                </p>
              </div>

              {/* Caption Field */}
              <div>
                <label className="block text-gray-300 font-normal mb-2">
                  What was this moment?
                </label>
                <textarea
                  value={formData.content_description}
                  onChange={(e) => handleInputChange('content_description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
                  placeholder="What was this moment?"
                />
                <p className="text-gray-400 text-xs mt-2">Caption is optional</p>
              </div>

              {ambiguousCandidates.length > 0 && !jambaseLink && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                  <p className="text-amber-200 text-sm font-medium">Which venue was this?</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {ambiguousCandidates.map((c) => (
                      <button
                        key={c.jambase_event_id ?? c.jambase_venue_id ?? 'candidate'}
                        type="button"
                        onClick={() => applyClipCandidate(c)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white border border-white/10"
                      >
                        <span className="font-medium">{c.artist_name ?? 'Artist'}</span>
                        <span className="text-gray-400"> · {c.venue_name}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {c.location} · {c.startDate ? new Date(c.startDate).toLocaleString() : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-Populated Tags */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium">Tags</label>
                  <button
                    type="button"
                    onClick={() => setIsEditingTags(!isEditingTags)}
                    className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
                  >
                    {isEditingTags ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" />
                        <span>Change Artist/Venue</span>
                      </>
                    )}
                  </button>
                </div>

                {isEditingTags ? (
                  /* Tag Editing UI */
                  <div className="space-y-4">
                    {/* Artist */}
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={artistSearch}
                          onChange={(e) => {
                            setArtistSearch(e.target.value);
                            handleInputChange('artist_name', e.target.value);
                          }}
                          onFocus={() => artistSuggestions.length > 0 && setShowArtistSuggestions(true)}
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
                          placeholder="Artist name"
                        />
                        <Music className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                      </div>
                      
                      {showArtistSuggestions && artistSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-cyan-500/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {artistSuggestions.map((artist) => (
                            <button
                              key={artist.identifier}
                              type="button"
                              onClick={() => handleArtistSelect(artist)}
                              className="w-full px-3 py-2 text-left hover:bg-cyan-500/20 transition-colors border-b border-white/10 last:border-0"
                            >
                              <div className="text-white text-sm font-medium">{artist.name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Venue */}
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={venueSearch}
                          onChange={(e) => {
                            setVenueSearch(e.target.value);
                            handleInputChange('venue_name', e.target.value);
                          }}
                          onFocus={() => venueSuggestions.length > 0 && setShowVenueSuggestions(true)}
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
                          placeholder="Venue name"
                        />
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
                      </div>
                      
                      {showVenueSuggestions && venueSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-cyan-500/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {venueSuggestions.map((venue) => (
                            <button
                              key={venue.identifier}
                              type="button"
                              onClick={() => handleVenueSelect(venue)}
                              className="w-full px-3 py-2 text-left hover:bg-cyan-500/20 transition-colors border-b border-white/10 last:border-0"
                            >
                              <div className="text-white text-sm font-medium">{venue.name}</div>
                              {venue.location?.city && (
                                <div className="text-xs text-gray-400">
                                  {venue.location.city}{venue.location.state ? `, ${venue.location.state}` : ''}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Location */}
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
                        placeholder="Location"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                ) : (
                  /* Tag Display */
                  <div className="bg-white/5 rounded-lg p-4 space-y-2">
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Music className="w-4 h-4 text-purple-400" />
                      <span className="text-sm">{formData.artist_name || 'Artist not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{formData.venue_name || 'Venue not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">{formData.location || 'Location not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400 text-xs pt-1 border-t border-white/10">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>Recorded {currentDate}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Hashtags — same field as full Share your moment form */}
              <div>
                <label className="block text-gray-300 font-normal mb-2">Hashtags</label>
                <input
                  type="text"
                  value={formData.hashtags}
                  onChange={(e) => handleInputChange('hashtags', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 transition-colors"
                  placeholder="#rock #livemusic #concert"
                />
                <p className="text-gray-400 text-xs mt-2">Separate with spaces (optional)</p>
              </div>

              {/* Upload Progress */}
              {loading && (uploadProgress.video > 0 || uploadProgress.thumbnail > 0) && (
                <div className="space-y-3">
                  {uploadProgress.video > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Uploading video...</span>
                        <span className="text-sm font-bold text-cyan-400">{uploadProgress.video}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                          style={{ width: `${uploadProgress.video}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {uploadProgress.thumbnail > 0 && uploadProgress.thumbnail < 100 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Uploading thumbnail...</span>
                        <span className="text-sm font-bold text-purple-400">{uploadProgress.thumbnail}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-600 transition-all duration-300"
                          style={{ width: `${uploadProgress.thumbnail}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                {/* Primary: Post to Feed */}
                <button
                  onClick={() => handleSubmit(null, 'published')}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-white text-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-green-500/30"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {uploadProgress.video < 100 ? 'Uploading...' : 'Processing...'}
                      </span>
                    </span>
                  ) : (
                    'Share your moment'
                  )}
                </button>

                {/* Secondary: Save as Draft */}
                <button
                  onClick={handleSaveAsDraft}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-white/10 border border-white/20 backdrop-blur-lg rounded-xl font-semibold text-gray-300 hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  Save as Draft
                </button>

                {/* Tertiary: Re-record */}
                <button
                  onClick={handleReRecord}
                  disabled={loading}
                  className="w-full text-gray-400 hover:text-white transition-colors text-sm font-medium py-2"
                >
                  Re-record
                </button>
              </div>
            </div>
          </div>
        </div>

        {confirmationModal}
      </div>
    );
  }

  // FULL UPLOAD FORM - Original interface
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h1 className="text-2xl sm:text-4xl font-bold text-white min-w-0">Share Your Moment</h1>
            <button
              type="button"
              onClick={handleCloseUploadToFeed}
              className="shrink-0 flex items-center justify-center p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95 transition-transform"
              aria-label="Close and go to feed"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-300 text-lg">Drop that fire from last night's show</p>
        </div>

        <form onSubmit={(e) => handleSubmit(e, 'published')} className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          {resolveNotice && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-200 text-sm">{resolveNotice}</p>
            </div>
          )}

          {/* Upload Method Toggle */}
          <div>
            <label className="block text-white font-medium mb-3">Upload Method</label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                  uploadMethod === 'file'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Upload Files</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('url')}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                  uploadMethod === 'url'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <Film className="w-5 h-5" />
                  <span>Use URLs</span>
                </div>
              </button>
            </div>
          </div>

          {/* Video Upload/URL */}
          {uploadMethod === 'file' ? (
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <Film className="w-5 h-5 text-cyan-400" />
                <span>Video File *</span>
              </label>
              <div className="relative">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full px-4 py-6 bg-white/10 border-2 border-dashed border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors flex flex-col items-center justify-center space-y-2"
                >
                  <Upload className="w-8 h-8 text-cyan-400" />
                  <span className="text-lg">
                    {formData.video_file 
                      ? formData.video_file.name 
                      : formData.video_blob 
                        ? '✓ Recorded video ready to upload' 
                        : 'Drop your clip here'}
                  </span>
                  <span className="text-sm text-gray-400">
                    {formData.video_blob ? 'Or click to replace with a file' : 'MP4, MOV, AVI (max 500MB)'}
                  </span>
                </button>
              </div>
              {uploadProgress.video > 0 && uploadProgress.video < 100 && (
                <div className="mt-2">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress.video}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Uploading video... {uploadProgress.video}%</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <Film className="w-5 h-5 text-cyan-400" />
                <span>Video URL *</span>
              </label>
              <input
                type="url"
                value={formData.video_url}
                onChange={(e) => handleInputChange('video_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="https://example.com/video.mp4"
                required
              />
              <p className="text-gray-400 text-sm mt-2">Paste the direct URL to your video file</p>
            </div>
          )}

          {/* Thumbnail Upload/URL */}
          {uploadMethod === 'file' ? (
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <span>Thumbnail Image (optional)</span>
              </label>
              <div className="relative">
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="w-full px-4 py-6 bg-white/10 border-2 border-dashed border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors flex flex-col items-center justify-center space-y-2"
                >
                  <ImageIcon className="w-8 h-8 text-cyan-400" />
                  <span className="text-lg">
                    {formData.thumbnail_file ? formData.thumbnail_file.name : 'Click to select thumbnail'}
                  </span>
                  <span className="text-sm text-gray-400">JPG, PNG, WebP (max 10MB)</span>
                </button>
              </div>
              {uploadProgress.thumbnail > 0 && uploadProgress.thumbnail < 100 && (
                <div className="mt-2">
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress.thumbnail}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Uploading thumbnail... {uploadProgress.thumbnail}%</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <ImageIcon className="w-5 h-5 text-cyan-400" />
                <span>Thumbnail URL (optional)</span>
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="https://example.com/thumbnail.jpg"
              />
            </div>
          )}

          {ambiguousCandidates.length > 0 && !jambaseLink && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
              <p className="text-amber-200 text-sm font-medium">Which venue was this?</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {ambiguousCandidates.map((c) => (
                  <button
                    key={c.jambase_event_id ?? c.jambase_venue_id ?? 'candidate'}
                    type="button"
                    onClick={() => applyClipCandidate(c)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white border border-white/10"
                  >
                    <span className="font-medium">{c.artist_name ?? 'Artist'}</span>
                    <span className="text-gray-400"> · {c.venue_name}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {c.location} · {c.startDate ? new Date(c.startDate).toLocaleString() : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Artist Name with Autocomplete */}
          <div className="relative">
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Music className="w-5 h-5 text-purple-400" />
              <span>Artist Name</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={artistSearch}
                onChange={(e) => {
                  setArtistSearch(e.target.value);
                  handleInputChange('artist_name', e.target.value);
                }}
                onFocus={() => artistSuggestions.length > 0 && setShowArtistSuggestions(true)}
                className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Taylor Swift"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              {jambaseLoading && (
                <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>
            
            {/* Artist Suggestions Dropdown */}
            {showArtistSuggestions && artistSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-cyan-500/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {artistSuggestions.map((artist) => (
                  <button
                    key={artist.identifier}
                    type="button"
                    onClick={() => handleArtistSelect(artist)}
                    className="w-full px-4 py-3 text-left hover:bg-cyan-500/20 transition-colors border-b border-white/10 last:border-0"
                  >
                    <div className="flex items-center space-x-3">
                      {artist.image && (
                        <img src={artist.image} alt={artist.name} className="w-10 h-10 rounded-full object-cover" />
                      )}
                      <div>
                        <div className="text-white font-medium">{artist.name}</div>
                        {artist.description && (
                          <div className="text-sm text-gray-400 line-clamp-1">{artist.description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-gray-400 text-sm mt-2">Who rocked the stage?</p>
          </div>

          {/* Venue and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span>Venue Name</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={venueSearch}
                  onChange={(e) => {
                    setVenueSearch(e.target.value);
                    handleInputChange('venue_name', e.target.value);
                  }}
                  onFocus={() => venueSuggestions.length > 0 && setShowVenueSuggestions(true)}
                  className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  placeholder="Madison Square Garden"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              
              {/* Venue Suggestions Dropdown */}
              {showVenueSuggestions && venueSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-cyan-500/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {venueSuggestions.map((venue) => (
                    <button
                      key={venue.identifier}
                      type="button"
                      onClick={() => handleVenueSelect(venue)}
                      className="w-full px-4 py-3 text-left hover:bg-cyan-500/20 transition-colors border-b border-white/10 last:border-0"
                    >
                      <div className="text-white font-medium">{venue.name}</div>
                      {venue.location?.city && (
                        <div className="text-sm text-gray-400">
                          {venue.location.city}{venue.location.state ? `, ${venue.location.state}` : ''}
                        </div>
                      )}
                      {venue.capacity && (
                        <div className="text-xs text-gray-500">Capacity: {venue.capacity.toLocaleString()}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-gray-400 text-sm mt-2">Where was the magic?</p>
            </div>

            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <MapPin className="w-5 h-5 text-green-400" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="New York, NY"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-white font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.content_description}
              onChange={(e) => handleInputChange('content_description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              placeholder="Tell everyone about this epic moment..."
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Hash className="w-5 h-5 text-orange-400" />
              <span>Hashtags</span>
            </label>
            <input
              type="text"
              value={formData.hashtags}
              onChange={(e) => handleInputChange('hashtags', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              placeholder="#rock #livemusic #concert"
            />
            <p className="text-gray-400 text-sm mt-2">Separate hashtags with spaces (e.g., #rock #pop #concert)</p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-4 bg-black/30 border border-cyan-500/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading Your Moment...</span>
                </span>
              ) : (
                'Share It'
              )}
            </button>
          </div>
        </form>
      </div>
      {confirmationModal}
    </div>
  );
}
