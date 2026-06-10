import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import {
  Upload,
  MapPin,
  Music,
  Calendar,
  Hash,
  Loader2,
  X,
  Film,
  Image as ImageIcon,
  Search,
  Edit2,
  Check,
  Disc3,
} from 'lucide-react';
import Header from '@/react-app/components/Header';
import QuickRecordButton from '@/react-app/components/QuickRecordButton';
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import {
  primeGeolocationOnUserGesture,
  isGeolocationSecureContext,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';
import {
  mergeSongTitleIntoCaption,
  auddSourceKey,
  identifyMusicForClip,
  isFatalSongIdentifyError,
  normalizeIdentifyResult,
  shouldShowManualSongTitleEntry,
  type AudDNavPrefill,
  type LiveSongSnapshot,
} from '@/react-app/utils/auddIdentify';
import type { JamBaseArtist, JamBaseVenue, ClipShowCandidate } from '@/shared/types';
import { resolveClipEventTitle } from '@/shared/event-title';

import { CLIP_GENRE_OPTIONS } from '@/shared/music-genres';
import { clipShowFieldsForContentFeed, isPrePostContentFeed } from '@/shared/pre-post-clip';
import ClipUploadStatusBanner from '@/react-app/components/ClipUploadStatusBanner';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import {
  classifyContentFeedForClip,
  contentFeedUserMessage,
} from '@/react-app/utils/classifyContentFeed';
import { classifyContentFeed, type ContentFeedClassification } from '@/shared/content-feed';
import {
  extractVideoFileMetadata,
  type ExtractedVideoFileMetadata,
} from '@/react-app/utils/extractVideoFileMetadata';

export default function UploadClip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPending } = useAuth();
  const { searchArtists, searchVenues, loading: jambaseLoading } = useJamBase();
  const { getDeviceCoordinates, location: lastKnownGeo, ingestCaptureGeo } = useGeolocation();
  const { setHideBottomNav } = useMobileChrome();
  const { enqueue: enqueueClipUpload } = useClipUploadQueue();
  const [loading, setLoading] = useState(false);
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

  /** JamBase pick committed in caption/tags editor — keeps autocomplete closed until the user edits again. */
  const captionCommittedArtistNameRef = useRef('');
  const captionCommittedVenueNameRef = useRef('');
  /** After Share — ignore stale `location.state` video until a new recording navigates here. */
  const skipNavVideoHydrationRef = useRef(false);
  const lastCaptionFromNavAtRef = useRef<string | null>(null);
  /** User changed tags — block auto-tag / song ID from overwriting edits. */
  const userOverrodeAutoTagsRef = useRef(false);
  /** Auto venue match from GPS applied at most once per clip. */
  const autoShowTagAppliedRef = useRef(false);
  const isEditingTagsRef = useRef(false);
  const [libraryFileMeta, setLibraryFileMeta] = useState<ExtractedVideoFileMetadata | null>(null);
  const [libraryMetaReady, setLibraryMetaReady] = useState(false);

  type UploadSource = 'capture' | 'library';
  const [uploadSource, setUploadSource] = useState<UploadSource>(() => {
    const nav = location.state as {
      fromPhotoLibrary?: boolean;
      videoBlob?: unknown;
      videoFile?: unknown;
    } | null;
    if (nav?.fromPhotoLibrary || (nav?.videoFile && !nav?.videoBlob)) return 'library';
    return 'capture';
  });

  // Caption / review screen video preview (must not live inside `if (showCaptionScreen)` — Rules of Hooks)
  const captionVideoRef = useRef<HTMLVideoElement>(null);
  const [captionVideoPlaying, setCaptionVideoPlaying] = useState(false);
  const [captionVideoMuted, setCaptionVideoMuted] = useState(true);

  // Quick capture modal state
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [reRecordPrimedStream, setReRecordPrimedStream] = useState<MediaStream | null>(null);
  const [reRecordGesturePending, setReRecordGesturePending] = useState(false);
  const [reRecordLaunchGeo, setReRecordLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [reRecordLaunchGeoResolved, setReRecordLaunchGeoResolved] = useState(false);
  /** `?quickCapture=true` uses a Continue tap so geolocation runs in a user gesture (iOS Safari). */
  const [quickCaptureAwaitUserTap, setQuickCaptureAwaitUserTap] = useState(false);

  const [isEditingTags, setIsEditingTags] = useState(false);

  useEffect(() => {
    isEditingTagsRef.current = isEditingTags;
  }, [isEditingTags]);

  const markTagsEdited = useCallback(() => {
    userOverrodeAutoTagsRef.current = true;
  }, []);

  const beginEditingTags = useCallback(() => {
    markTagsEdited();
    captionCommittedArtistNameRef.current = '';
    captionCommittedVenueNameRef.current = '';
    setIsEditingTags(true);
  }, [markTagsEdited]);

  const [jambaseLink, setJambaseLink] = useState<{
    event: string | null;
    artist: string | null;
    venue: string | null;
    eventTitle: string | null;
  } | null>(null);
  const [recordingAtIso, setRecordingAtIso] = useState<string | null>(null);
  const [captureGeo, setCaptureGeo] = useState<{
    latitude: number;
    longitude: number;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null>(null);
  const [resolveNotice, setResolveNotice] = useState<string | null>(null);
  /** Top nearby venues when auto-apply is skipped (wrong day or >0.25 mi). */
  const [nearbyVenueChoices, setNearbyVenueChoices] = useState<ClipShowCandidate[]>([]);

  /** ACRCloud song ID on the post-capture screen (short audio snippet from the clip). */
  const [auddStatus, setAuddStatus] = useState<
    'idle' | 'loading' | 'done' | 'skipped' | 'nomatch' | 'error'
  >('idle');
  const [auddMessage, setAuddMessage] = useState<string | null>(null);
  const auddAttemptedForSourceKeyRef = useRef<string | null>(null);

  const [classifyStatus, setClassifyStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle',
  );
  const [classifyResult, setClassifyResult] = useState<ContentFeedClassification | null>(null);
  const [classifyMessage, setClassifyMessage] = useState<string | null>(null);
  const [storedClassificationId, setStoredClassificationId] = useState<string | null>(null);
  const classifyAttemptedForSourceKeyRef = useRef<string | null>(null);

  /** Apply GPS from navigation state before paint so resolve-show sees coords on first run. */
  useLayoutEffect(() => {
    const nav = location.state as {
      videoBlob?: unknown;
      captureGeo?: {
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
        country: string | null;
      };
    } | null | undefined;
    if (!nav?.videoBlob || !nav.captureGeo) return;
    const cg = nav.captureGeo;
    if (Number.isFinite(cg.latitude) && Number.isFinite(cg.longitude)) {
      setCaptureGeo(cg);
    }
  }, [location.state]);

  /** Keep hook `location` in sync with capture coords so resolve + fallbacks see the same point. */
  useEffect(() => {
    if (
      !captureGeo ||
      !Number.isFinite(captureGeo.latitude) ||
      !Number.isFinite(captureGeo.longitude)
    ) {
      return;
    }
    ingestCaptureGeo({
      latitude: captureGeo.latitude,
      longitude: captureGeo.longitude,
      city: captureGeo.city,
      state: captureGeo.state,
      country: captureGeo.country,
    });
  }, [captureGeo, ingestCaptureGeo]);

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
    song_title: '',
    genre_name: '',
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
    setHideBottomNav(showCaptionScreen || showQuickCapture);
    return () => setHideBottomNav(false);
  }, [showCaptionScreen, showQuickCapture, setHideBottomNav]);

  // Open quick capture when ?quickCapture=true — needs an explicit Continue tap for location (iOS gesture policy).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantCapture = params.get('quickCapture') === 'true';
    if (!wantCapture) {
      // Do not clear capture overlay or primed geo here — Share on /upload opens the camera without `?quickCapture`.
      setQuickCaptureAwaitUserTap(false);
      return;
    }
    if (showCaptionScreen) {
      setShowQuickCapture(false);
      setQuickCaptureAwaitUserTap(false);
      return;
    }
    if (isPending) return;
    if (!user) {
      setShowQuickCapture(false);
      setQuickCaptureAwaitUserTap(false);
      navigate('/auth', { replace: true });
      return;
    }
    if (showQuickCapture) {
      setQuickCaptureAwaitUserTap(false);
      return;
    }
    setQuickCaptureAwaitUserTap(true);
  }, [location.search, showCaptionScreen, user, isPending, navigate, showQuickCapture]);

  // Check if we received a recorded video blob from QuickRecord
  useEffect(() => {
    const navAt =
      typeof (location.state as { recordingStartedAt?: string } | null)?.recordingStartedAt ===
      'string'
        ? (location.state as { recordingStartedAt: string }).recordingStartedAt
        : null;

    if (location.state?.videoBlob) {
      if (
        skipNavVideoHydrationRef.current &&
        (!navAt || navAt === lastCaptionFromNavAtRef.current)
      ) {
        return;
      }
      skipNavVideoHydrationRef.current = false;
      lastCaptionFromNavAtRef.current = navAt;

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
      const fileAt = navAt ?? `file:${(location.state.videoFile as File).lastModified}`;
      if (
        skipNavVideoHydrationRef.current &&
        fileAt === lastCaptionFromNavAtRef.current
      ) {
        return;
      }
      skipNavVideoHydrationRef.current = false;
      lastCaptionFromNavAtRef.current = fileAt;

      const selectedFile = location.state.videoFile as File;
      setFormData(prev => ({ ...prev, video_file: selectedFile, video_blob: null }));
      setUploadMethod('file');
      const fileUrl = URL.createObjectURL(selectedFile);
      setVideoBlobUrl(fileUrl);
      setShowCaptionScreen(true);
      setUploadSource('library');
      setIsEditingTags(false);
      setLibraryFileMeta(null);
      setLibraryMetaReady(false);
      setShowQuickCapture(false);
      setReRecordPrimedStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
      setReRecordGesturePending(false);
    }
    
    // Check if we received show data from auto-tagging (live capture only — not photo library)
    const navFromLibrary = Boolean(
      (location.state as { fromPhotoLibrary?: boolean } | null)?.fromPhotoLibrary,
    );
    if (location.state?.showData && !navFromLibrary) {
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

      if (showData.artist_name) {
        const an = String(showData.artist_name);
        setArtistSearch(an);
        captionCommittedArtistNameRef.current = an;
      }
      if (showData.venue_name) {
        const vn = String(showData.venue_name);
        setVenueSearch(vn);
        if (typeof showData.jambase_venue_id === 'string') {
          captionCommittedVenueNameRef.current = vn;
        }
      }

      if (typeof showData.jambase_event_id === 'string') {
        setJambaseLink({
          event: showData.jambase_event_id,
          artist: typeof showData.jambase_artist_id === 'string' ? showData.jambase_artist_id : null,
          venue: typeof showData.jambase_venue_id === 'string' ? showData.jambase_venue_id : null,
          eventTitle: resolveClipEventTitle({
            event_title: typeof showData.event_title === 'string' ? showData.event_title : null,
            artist_name: typeof showData.artist_name === 'string' ? showData.artist_name : null,
            venue_name: typeof showData.venue_name === 'string' ? showData.venue_name : null,
          }),
        });
      } else if (typeof showData.jambase_venue_id === 'string') {
        setJambaseLink({
          event: null,
          artist: typeof showData.jambase_artist_id === 'string' ? showData.jambase_artist_id : null,
          venue: showData.jambase_venue_id,
          eventTitle: resolveClipEventTitle({
            event_title: typeof showData.event_title === 'string' ? showData.event_title : null,
            artist_name: typeof showData.artist_name === 'string' ? showData.artist_name : null,
            venue_name: typeof showData.venue_name === 'string' ? showData.venue_name : null,
          }),
        });
      } else {
        const eventTitleFromShow = resolveClipEventTitle({
          event_title: typeof showData.event_title === 'string' ? showData.event_title : null,
          artist_name: typeof showData.artist_name === 'string' ? showData.artist_name : null,
          venue_name: typeof showData.venue_name === 'string' ? showData.venue_name : null,
        });
        if (eventTitleFromShow) {
          setJambaseLink({
            event: null,
            artist: null,
            venue: null,
            eventTitle: eventTitleFromShow,
          });
        }
      }
      setResolveNotice(null);
    }

    const nav = location.state as Record<string, unknown> | undefined;
    if (typeof nav?.recordingStartedAt === 'string' && !navFromLibrary) {
      setRecordingAtIso(nav.recordingStartedAt);
    }
    if (
      nav?.captureGeo &&
      typeof nav.captureGeo === 'object' &&
      nav.captureGeo !== null &&
      !navFromLibrary
    ) {
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

    // Live capture may have prefilled song — show immediately; caption screen still runs a full identify pass.
    const navWithAudD = location.state as {
      auddPrefill?: AudDNavPrefill;
      fromPhotoLibrary?: boolean;
    } | null | undefined;
    const ap = navWithAudD?.auddPrefill;
    if (ap?.sourceKey && !navWithAudD?.fromPhotoLibrary) {
      if (ap.status === 'done') {
        const artist = (ap.artist ?? '').trim();
        const title = (ap.title ?? '').trim();
        if (artist || title) {
          setAuddStatus('done');
          setAuddMessage(ap.message);
          setFormData((prev) => ({
            ...prev,
            artist_name: prev.artist_name?.trim() ? prev.artist_name : artist || prev.artist_name,
            song_title: prev.song_title?.trim() ? prev.song_title : title || prev.song_title,
            content_description: title
              ? mergeSongTitleIntoCaption(prev.content_description, title)
              : prev.content_description,
          }));
          if (artist) {
            captionCommittedArtistNameRef.current = artist;
            setArtistSearch(artist);
          }
        } else {
          setAuddStatus('idle');
          setAuddMessage(null);
        }
      } else if (ap.status === 'skipped' || ap.status === 'nomatch') {
        setAuddStatus('idle');
        setAuddMessage(null);
      } else if (ap.status === 'error') {
        const msg = ap.message ?? '';
        if (isFatalSongIdentifyError({ status: 'error', message: msg })) {
          setAuddStatus('error');
          setAuddMessage(msg || 'Song lookup failed');
        } else {
          setAuddStatus('idle');
          setAuddMessage(null);
        }
      }
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
  const [artistSearchPending, setArtistSearchPending] = useState(false);
  const debouncedArtistSearch = useDebounce(artistSearch, 300);
  
  // Venue autocomplete
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSuggestions, setVenueSuggestions] = useState<JamBaseVenue[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);
  const [venueSearchPending, setVenueSearchPending] = useState(false);
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  const releaseVenueAutocompleteLock = useCallback(() => {
    markTagsEdited();
    captionCommittedVenueNameRef.current = '';
    if (venueSearch.trim().length >= 2) {
      setShowVenueSuggestions(true);
    }
  }, [markTagsEdited, venueSearch]);

  const releaseArtistAutocompleteLock = useCallback(() => {
    markTagsEdited();
    captionCommittedArtistNameRef.current = '';
    if (artistSearch.trim().length >= 2) {
      setShowArtistSuggestions(true);
    }
  }, [markTagsEdited, artistSearch]);

  const venueLocationHint =
    formData.location?.trim() ||
    (captureGeo?.city
      ? [captureGeo.city, captureGeo.state].filter(Boolean).join(', ')
      : '');

  // Search for artists
  useEffect(() => {
    if (debouncedArtistSearch && debouncedArtistSearch.length >= 2) {
      setArtistSearchPending(true);
      searchArtists(debouncedArtistSearch)
        .then((results) => {
          setArtistSuggestions(results);
          const keepClosed =
            !isEditingTags &&
            debouncedArtistSearch === captionCommittedArtistNameRef.current;
          setShowArtistSuggestions(!keepClosed && results.length > 0);
        })
        .finally(() => setArtistSearchPending(false));
    } else {
      setArtistSuggestions([]);
      setShowArtistSuggestions(false);
      setArtistSearchPending(false);
    }
  }, [debouncedArtistSearch, searchArtists, isEditingTags]);

  // Search for venues (JamBase)
  useEffect(() => {
    if (debouncedVenueSearch && debouncedVenueSearch.length >= 2) {
      setVenueSearchPending(true);
      searchVenues(debouncedVenueSearch, venueLocationHint || undefined)
        .then((results) => {
          setVenueSuggestions(results);
          const keepClosed =
            !isEditingTags &&
            debouncedVenueSearch === captionCommittedVenueNameRef.current;
          setShowVenueSuggestions(!keepClosed && debouncedVenueSearch.length >= 2);
        })
        .finally(() => setVenueSearchPending(false));
    } else {
      setVenueSuggestions([]);
      setShowVenueSuggestions(false);
      setVenueSearchPending(false);
    }
  }, [debouncedVenueSearch, venueLocationHint, searchVenues, isEditingTags]);

  /** Read GPS + recorded-at from library video file bytes (not current device location). */
  useEffect(() => {
    const file = formData.video_file;
    if (!file || uploadSource !== 'library') {
      setLibraryFileMeta(null);
      setLibraryMetaReady(uploadSource !== 'library');
      return;
    }

    let cancelled = false;
    setLibraryMetaReady(false);
    setLibraryFileMeta(null);

    void (async () => {
      try {
        const meta = await extractVideoFileMetadata(file);
        if (cancelled) return;
        setLibraryFileMeta(meta);

        if (meta.recordedAtIso) {
          setRecordingAtIso(meta.recordedAtIso);
        }
        if (meta.latitude != null && meta.longitude != null) {
          setCaptureGeo({
            latitude: meta.latitude,
            longitude: meta.longitude,
            city: null,
            state: null,
            country: null,
          });
        } else {
          setCaptureGeo(null);
        }
        if (meta.recording_orientation || meta.width || meta.height) {
          setVideoMetadata((prev) => ({
            ...prev,
            recording_orientation: meta.recording_orientation ?? prev.recording_orientation,
            video_resolution_w: meta.width ?? prev.video_resolution_w,
            video_resolution_h: meta.height ?? prev.video_resolution_h,
          }));
        }

        const hasUsefulMeta =
          Boolean(meta.recordedAtIso) ||
          (meta.latitude != null && meta.longitude != null);
        if (!hasUsefulMeta) {
          beginEditingTags();
          setResolveNotice(
            'No date or location found in this video file — add artist, venue, and song below.',
          );
        } else {
          setIsEditingTags(false);
          autoShowTagAppliedRef.current = false;
          const parts: string[] = [];
          if (meta.recordedAtIso) {
            parts.push(
              meta.recordedAtSource === 'embedded'
                ? 'recorded date from video file'
                : 'date from file timestamp',
            );
          }
          if (meta.locationSource === 'embedded') {
            parts.push('location from video file');
          }
          setResolveNotice(
            parts.length > 0
              ? `Using ${parts.join(' and ')} to find a matching show…`
              : null,
          );
        }
      } catch (err) {
        console.error('extractVideoFileMetadata', err);
        if (!cancelled) {
          beginEditingTags();
          setResolveNotice('Could not read video metadata — add details manually below.');
        }
      } finally {
        if (!cancelled) setLibraryMetaReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.video_file, uploadSource, beginEditingTags, markTagsEdited]);

  // Keep caption search fields aligned with committed tags when not editing (mobile).
  useEffect(() => {
    if (!showCaptionScreen || isEditingTags) return;
    setArtistSearch(formData.artist_name);
    setVenueSearch(formData.venue_name);
    setShowArtistSuggestions(false);
    setShowVenueSuggestions(false);
  }, [showCaptionScreen, isEditingTags, formData.artist_name, formData.venue_name]);

  const applyClipCandidate = useCallback((c: ClipShowCandidate, opts?: { force?: boolean }) => {
    if (
      !opts?.force &&
      (userOverrodeAutoTagsRef.current || isEditingTagsRef.current)
    ) {
      return;
    }
    autoShowTagAppliedRef.current = true;
    setFormData((prev) => ({
      ...prev,
      artist_name: c.artist_name ?? '',
      venue_name: c.venue_name ?? '',
      location: c.location ?? prev.location,
    }));
    setArtistSearch(c.artist_name ?? '');
    setVenueSearch(c.venue_name ?? '');
    captionCommittedVenueNameRef.current = c.venue_name ?? '';
    setJambaseLink({
      event: c.jambase_event_id ?? null,
      artist: c.jambase_artist_id,
      venue: c.jambase_venue_id,
      eventTitle: resolveClipEventTitle({
        event_title: c.event_title,
        artist_name: c.artist_name,
        venue_name: c.venue_name,
      }),
    });
    captionCommittedArtistNameRef.current = c.artist_name ?? '';
    setResolveNotice(null);
    setNearbyVenueChoices([]);
  }, []);

  const handleNearbyVenuePick = useCallback(
    (c: ClipShowCandidate) => {
      applyClipCandidate(c, { force: true });
      setResolveNotice(null);
    },
    [applyClipCandidate],
  );

  useEffect(() => {
    if (
      formData.video_file &&
      uploadSource !== 'library' &&
      !(location.state as { recordingStartedAt?: string } | null)?.recordingStartedAt
    ) {
      setRecordingAtIso(new Date(formData.video_file.lastModified).toISOString());
    }
  }, [formData.video_file, uploadSource, location.state]);

  useEffect(() => {
    if (!user) return;

    const nav = location.state as {
      videoBlob?: unknown;
      showData?: { jambase_event_id?: string; jambase_venue_id?: string };
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
    const isQuickCaption = showCaptionScreen && fromQuick;

    const resolveForFile =
      Boolean(formData.video_file && uploadMethod === 'file' && !fromQuick);

    /** Auto-tag from GPS when QuickRecord did not preload show data */
    const resolveForAutoTagQuick = isQuickCaption && !nav?.showData;

    if (!resolveForFile && !resolveForAutoTagQuick) return;

    if (uploadSource === 'library') {
      if (!libraryMetaReady) return;
      if (autoShowTagAppliedRef.current || userOverrodeAutoTagsRef.current) return;
      if (!captureGeo?.latitude || !captureGeo?.longitude) return;
    } else {
      if (autoShowTagAppliedRef.current || userOverrodeAutoTagsRef.current) return;
      if (resolveForFile && (jambaseLink?.event || jambaseLink?.venue)) return;
    }

    const at =
      recordingAtIso ||
      libraryFileMeta?.recordedAtIso ||
      (formData.video_file ? new Date(formData.video_file.lastModified).toISOString() : null) ||
      (typeof nav?.recordingStartedAt === 'string' ? nav.recordingStartedAt : null) ||
      new Date().toISOString();

    let cancelled = false;
    (async () => {
      let geo = captureGeo;
      if (uploadSource === 'library') {
        if (
          !geo ||
          !Number.isFinite(geo.latitude) ||
          !Number.isFinite(geo.longitude)
        ) {
          return;
        }
      } else if (
        (geo == null || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) &&
        nav?.captureGeo != null &&
        Number.isFinite(nav.captureGeo.latitude) &&
        Number.isFinite(nav.captureGeo.longitude)
      ) {
        geo = nav.captureGeo;
        if (!cancelled) setCaptureGeo(geo);
      }
      if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) {
        const validG = (g: { latitude: number; longitude: number } | null | undefined) =>
          g != null &&
          Number.isFinite(g.latitude) &&
          Number.isFinite(g.longitude);

        if (fromQuick && uploadSource !== 'library' && !cancelled) {
          const device = await getDeviceCoordinates();
          if (cancelled) return;
          if (validG(device)) {
            geo = {
              latitude: device!.latitude,
              longitude: device!.longitude,
              city: device!.city ?? null,
              state: device!.state ?? null,
              country: device!.country ?? null,
            };
            setCaptureGeo(geo);
            ingestCaptureGeo(geo);
          }
        }

        if (
          uploadSource !== 'library' &&
          (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude))
        ) {
          const g = validG(lastKnownGeo) ? lastKnownGeo : null;
          if (cancelled) return;
          if (validG(g)) {
            geo = {
              latitude: g!.latitude,
              longitude: g!.longitude,
              city: g!.city ?? null,
              state: g!.state ?? null,
              country: g!.country ?? null,
            };
            setCaptureGeo(geo);
          } else {
            if (!cancelled) {
              setResolveNotice(
                fromQuick
                  ? 'Location was not available for this capture, so auto-tagging is skipped. You can enter details manually.'
                  : 'Turn on location when you use Capture to auto-tag venues, or enter details manually.'
              );
            }
            return;
          }
        }
      }
      if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude) || cancelled) return;

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
        if (cancelled) return;
        if (!res.ok) {
          setResolveNotice(
            res.status === 401
              ? 'Sign in again to match your clip to nearby JamBase venues.'
              : `Venue lookup failed (HTTP ${res.status}). In local development, run the worker so /api/clips/resolve-show is available (e.g. npm run dev:api with Vite proxy to port 8787).`
          );
          return;
        }
        const data = (await res.json()) as {
          match?: string;
          candidates?: ClipShowCandidate[];
          nearbyVenues?: ClipShowCandidate[];
          notice?: string;
        };
        if (cancelled) return;

        const pickerVenues = (data.nearbyVenues ?? []).slice(0, 3);
        setNearbyVenueChoices(pickerVenues);

        const applyClosest = () => {
          if (data.match === 'single' && data.candidates?.[0]) {
            applyClipCandidate(data.candidates[0]);
            setResolveNotice(null);
          } else if (data.match === 'ambiguous' && pickerVenues.length > 0) {
            setResolveNotice(
              data.notice ??
                'Several venues are nearby — pick the one you are at.',
            );
          } else if (data.match === 'none') {
            setResolveNotice(
              data.notice ??
                'No nearby JamBase venue matched your location. You can enter venue and artist manually.',
            );
          }
        };

        if (resolveForFile) {
          applyClosest();
        } else if (resolveForAutoTagQuick && !(jambaseLink?.event || jambaseLink?.venue)) {
          applyClosest();
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
    formData.video_file,
    uploadMethod,
    showCaptionScreen,
    recordingAtIso,
    captureGeo,
    location.state,
    lastKnownGeo,
    applyClipCandidate,
    getDeviceCoordinates,
    ingestCaptureGeo,
    uploadSource,
    libraryMetaReady,
    libraryFileMeta,
  ]);

  const clearShowAssociationFields = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      artist_name: '',
      venue_name: '',
      location: '',
      song_title: '',
      genre_name: '',
      hashtags: '',
    }));
    setArtistSearch('');
    setVenueSearch('');
    setJambaseLink(null);
    setResolveNotice(null);
    setNearbyVenueChoices([]);
    captionCommittedArtistNameRef.current = '';
    captionCommittedVenueNameRef.current = '';
    setIsEditingTags(false);
    setAuddStatus('idle');
    setAuddMessage(null);
  }, []);

  /**
   * Classify feed lane when the caption screen opens so we can simplify UI for talking clips.
   */
  useEffect(() => {
    if (!showCaptionScreen || !user || isPending) return;
    const source = formData.video_blob ?? formData.video_file;
    if (!source || !(source instanceof Blob)) return;

    const sourceKey = auddSourceKey(source);
    if (classifyAttemptedForSourceKeyRef.current === sourceKey) return;
    classifyAttemptedForSourceKeyRef.current = sourceKey;

    let cancelled = false;
    setClassifyStatus('loading');
    setClassifyMessage(null);
    setClassifyResult(null);
    setStoredClassificationId(null);

    void (async () => {
      const nav = location.state as { captureAudioBlob?: unknown } | null;
      const captureAudio =
        nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null;

      const out = await classifyContentFeedForClip({
        video: source,
        captureAudio,
        headlinerName: formData.artist_name?.trim() || null,
      });
      if (cancelled) return;

      if (!out.ok) {
        setClassifyStatus('error');
        setClassifyMessage(out.error);
        return;
      }

      setClassifyResult(out);
      setStoredClassificationId(out.classification_id ?? null);
      const ui = contentFeedUserMessage(out);
      setClassifyMessage(ui?.message ?? null);

      if (out.content_feed === 'rejected') {
        setClassifyStatus('error');
        return;
      }

      if (out.content_feed === 'pre_post') {
        clearShowAssociationFields();
      }

      setClassifyStatus('done');
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showCaptionScreen,
    user,
    isPending,
    formData.video_blob,
    formData.video_file,
    formData.artist_name,
    location.state,
    clearShowAssociationFields,
  ]);

  /** Re-derive main vs rejected when the user picks an artist after ACR identification. */
  useEffect(() => {
    if (classifyStatus !== 'done' || !classifyResult) return;
    if (!classifyResult.acr_matched) return;

    const acrMatch =
      classifyResult.acr_artist || classifyResult.acr_title
        ? {
            artist: classifyResult.acr_artist ?? '',
            title: classifyResult.acr_title ?? '',
          }
        : null;

    const derived = classifyContentFeed({
      acrMatch,
      headlinerName: formData.artist_name?.trim() || null,
      has_speech: classifyResult.has_speech,
    });

    const feedChanged = derived.content_feed !== classifyResult.content_feed;
    const headlinerChanged =
      derived.headliner_matched !== classifyResult.headliner_matched;
    if (!feedChanged && !headlinerChanged) return;

    setClassifyResult(derived);
    setStoredClassificationId(null);
    const ui = contentFeedUserMessage(derived);
    setClassifyMessage(ui?.message ?? null);
    if (derived.content_feed === 'rejected') {
      setClassifyStatus('error');
      return;
    }
    setClassifyStatus('done');
  }, [
    classifyStatus,
    classifyResult?.acr_matched,
    classifyResult?.acr_artist,
    classifyResult?.acr_title,
    classifyResult?.has_speech,
    classifyResult?.content_feed,
    classifyResult?.headliner_matched,
    formData.artist_name,
  ]);

  /**
   * Authoritative song ID on the clip details screen (ACRCloud/AudD).
   * Uses parallel mic audio from capture when available, then a video snippet; merges live preview matches.
   */
  useEffect(() => {
    if (!showCaptionScreen || !user || isPending) return;
    if (isPrePostContentFeed(classifyResult?.content_feed)) return;
    const source = formData.video_blob ?? formData.video_file;
    if (!source || !(source instanceof Blob)) return;

    const sourceKey = auddSourceKey(source);
    if (auddAttemptedForSourceKeyRef.current === sourceKey) return;
    auddAttemptedForSourceKeyRef.current = sourceKey;

    const nav = location.state as {
      captureAudioBlob?: unknown;
      auddPrefill?: AudDNavPrefill;
    } | null;
    const captureAudio =
      nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null;
    const ap = nav?.auddPrefill;
    const liveHint: LiveSongSnapshot | null =
      ap?.status === 'done' && (ap.artist?.trim() || ap.title?.trim())
        ? { artist: (ap.artist ?? '').trim(), title: (ap.title ?? '').trim() }
        : null;

    const hasProvisionalSong = Boolean(
      liveHint?.title || liveHint?.artist || formData.song_title?.trim(),
    );

    let cancelled = false;
    if (!hasProvisionalSong) {
      setAuddStatus('loading');
      setAuddMessage(null);
    }

    void (async () => {
      const result = normalizeIdentifyResult(
        await identifyMusicForClip(source, {
          live: liveHint,
          audio: captureAudio,
        }),
      );
      if (cancelled) return;

      if (userOverrodeAutoTagsRef.current) {
        setAuddStatus('idle');
        setAuddMessage(null);
        return;
      }

      if (
        result.status === 'skipped' ||
        result.status === 'nomatch' ||
        (result.status === 'error' && !isFatalSongIdentifyError(result))
      ) {
        setAuddStatus('idle');
        setAuddMessage(null);
        return;
      }
      if (result.status === 'error') {
        setAuddStatus('error');
        setAuddMessage(result.message);
        return;
      }

      const { artist, title, message } = result;
      const titleTrim = typeof title === 'string' ? title.trim() : '';
      setFormData((prev) => ({
        ...prev,
        artist_name: prev.artist_name?.trim() ? prev.artist_name : artist || prev.artist_name,
        song_title: prev.song_title?.trim() ? prev.song_title : titleTrim || prev.song_title,
        content_description: mergeSongTitleIntoCaption(prev.content_description, title),
      }));
      if (artist) {
        captionCommittedArtistNameRef.current = artist;
        setArtistSearch(artist);
      }
      setAuddStatus('done');
      setAuddMessage(message);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    showCaptionScreen,
    user,
    isPending,
    formData.video_blob,
    formData.video_file,
    location.state,
    uploadSource,
    classifyResult?.content_feed,
  ]);

  const handleInputChange = (field: string, value: string) => {
    if (
      field === 'artist_name' ||
      field === 'venue_name' ||
      field === 'location' ||
      field === 'song_title' ||
      field === 'content_description'
    ) {
      markTagsEdited();
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArtistSelect = (artist: JamBaseArtist) => {
    markTagsEdited();
    captionCommittedArtistNameRef.current = artist.name;
    setFormData((prev) => ({ ...prev, artist_name: artist.name }));
    setArtistSearch(artist.name);
    setArtistSuggestions([]);
    setShowArtistSuggestions(false);
    setJambaseLink((prev) => ({
      event: null,
      artist: artist.identifier,
      venue: prev?.venue ?? null,
      eventTitle: null,
    }));
  };

  const handleCaptionArtistSearchChange = (value: string) => {
    markTagsEdited();
    setArtistSearch(value);
    captionCommittedArtistNameRef.current = '';
    if (value.trim() === '') {
      setFormData((prev) => ({ ...prev, artist_name: '' }));
      setJambaseLink((prev) => (prev ? { ...prev, artist: null, event: null, eventTitle: null } : null));
      return;
    }
    setFormData((prev) => ({ ...prev, artist_name: value.trim() }));
    setJambaseLink((prev) => (prev ? { ...prev, artist: null, event: null, eventTitle: null } : null));
  };

  const handleCaptionVenueSearchChange = (value: string) => {
    markTagsEdited();
    setVenueSearch(value);
    captionCommittedVenueNameRef.current = '';
    if (value.trim() === '') {
      setFormData((prev) => ({ ...prev, venue_name: '' }));
      setJambaseLink((prev) => (prev ? { ...prev, venue: null, event: null, eventTitle: null } : null));
      return;
    }
    setFormData((prev) => ({ ...prev, venue_name: value.trim() }));
    setJambaseLink((prev) => (prev ? { ...prev, venue: null, event: null, eventTitle: null } : null));
  };

  const handleVenueSelect = (venue: JamBaseVenue) => {
    markTagsEdited();
    const venueName = venue.name;
    const venueLocation = venue.location?.city 
      ? `${venue.location.city}, ${venue.location.state || venue.location.country || ''}`
      : '';
    
    captionCommittedVenueNameRef.current = venueName;
    setFormData(prev => ({ 
      ...prev, 
      venue_name: venueName,
      location: venueLocation || prev.location
    }));
    setVenueSearch(venueName);
    setVenueSuggestions([]);
    setShowVenueSuggestions(false);
    setJambaseLink((prev) => ({
      event: null,
      artist: prev?.artist ?? null,
      venue: venue.identifier,
      eventTitle: null,
    }));
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
    setFormData((prev) => ({
      ...prev,
      video_file: file,
      video_blob: null,
      artist_name: '',
      venue_name: '',
      location: '',
      song_title: '',
      content_description: '',
    }));
    setUploadSource('library');
    setIsEditingTags(false);
    setLibraryFileMeta(null);
    setLibraryMetaReady(false);
    setJambaseLink(null);
    setResolveNotice(null);
    setAuddStatus('idle');
    setAuddMessage(null);
    userOverrodeAutoTagsRef.current = false;
    autoShowTagAppliedRef.current = false;
    auddAttemptedForSourceKeyRef.current = null;
    captionCommittedArtistNameRef.current = '';
    captionCommittedVenueNameRef.current = '';
    setArtistSearch('');
    setVenueSearch('');
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(URL.createObjectURL(file));
    setShowCaptionScreen(true);
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

  const resolveClassificationForPost = useCallback(async (): Promise<{
    classificationId: string;
    contentFeed: 'main' | 'pre_post';
  }> => {
    if (
      storedClassificationId &&
      classifyResult &&
      classifyResult.content_feed !== 'rejected' &&
      (classifyResult.content_feed === 'main' || classifyResult.content_feed === 'pre_post')
    ) {
      return {
        classificationId: storedClassificationId,
        contentFeed: classifyResult.content_feed,
      };
    }

    const source = formData.video_blob ?? formData.video_file;
    if (!source || !(source instanceof Blob)) {
      throw new Error('No video available for content classification.');
    }

    const nav = location.state as { captureAudioBlob?: unknown } | null;
    const captureAudio =
      nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null;

    setClassifyStatus('loading');
    setClassifyMessage(null);
    setClassifyResult(null);
    setStoredClassificationId(null);

    const out = await classifyContentFeedForClip({
      video: source,
      captureAudio,
      headlinerName: formData.artist_name?.trim() || null,
    });

    if (!out.ok) {
      setClassifyStatus('error');
      setClassifyMessage(out.error);
      throw new Error(out.error);
    }

    setClassifyResult(out);
    setStoredClassificationId(out.classification_id ?? null);
    const ui = contentFeedUserMessage(out);
    setClassifyMessage(ui?.message ?? null);

    if (out.content_feed === 'rejected') {
      setClassifyStatus('error');
      throw new Error(out.message);
    }

    if (out.content_feed === 'pre_post') {
      clearShowAssociationFields();
    }

    setClassifyStatus('done');
    if (!out.classification_id) {
      throw new Error('Classification did not return an id. Try again.');
    }
    if (out.content_feed !== 'main' && out.content_feed !== 'pre_post') {
      throw new Error('Invalid content feed classification.');
    }
    return {
      classificationId: out.classification_id,
      contentFeed: out.content_feed,
    };
  }, [
    storedClassificationId,
    classifyResult,
    formData.video_blob,
    formData.video_file,
    formData.artist_name,
    location.state,
    clearShowAssociationFields,
  ]);

  const buildUploadPayload = useCallback(
    (classificationId: string, contentFeed: 'main' | 'pre_post'): ClipUploadJobPayload => {
    const nav = location.state as { captureAudioBlob?: unknown } | null;
    return {
      uploadMethod,
      videoFile: formData.video_file,
      videoBlob: formData.video_blob,
      thumbnailFile: formData.thumbnail_file,
      videoUrl: formData.video_url,
      classificationId,
      contentFeed,
      captureAudioBlob:
        nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null,
      form: {
        artist_name: formData.artist_name,
        venue_name: formData.venue_name,
        location: formData.location,
        content_description: formData.content_description,
        song_title: formData.song_title,
        genre_name: formData.genre_name,
        hashtags: formData.hashtags,
      },
      jambaseLink,
      recordingAtIso,
      captureGeo,
      videoMetadata,
    };
  },
    [
      uploadMethod,
      formData,
      jambaseLink,
      recordingAtIso,
      captureGeo,
      videoMetadata,
      location.state,
    ],
  );

  const resetForNextCapture = useCallback(() => {
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    setShowCaptionScreen(false);
    setFormData({
      video_file: null,
      video_blob: null,
      thumbnail_file: null,
      video_url: '',
      thumbnail_url: '',
      artist_name: '',
      venue_name: '',
      location: '',
      content_description: '',
      song_title: '',
      genre_name: '',
      hashtags: '',
    });
    setArtistSearch('');
    setVenueSearch('');
    setVideoMetadata({});
    setJambaseLink(null);
    setResolveNotice(null);
    setNearbyVenueChoices([]);
    setRecordingAtIso(null);
    setCaptureGeo(null);
    setError(null);
    setCaptionVideoPlaying(false);
    setCaptionVideoMuted(true);
    captionCommittedArtistNameRef.current = '';
    captionCommittedVenueNameRef.current = '';
    auddAttemptedForSourceKeyRef.current = null;
    setAuddStatus('idle');
    setAuddMessage(null);
    setClassifyStatus('idle');
    setClassifyResult(null);
    setClassifyMessage(null);
    setStoredClassificationId(null);
    classifyAttemptedForSourceKeyRef.current = null;
    setIsEditingTags(false);
    userOverrodeAutoTagsRef.current = false;
    autoShowTagAppliedRef.current = false;
    setUploadSource('capture');
    setLibraryFileMeta(null);
    setLibraryMetaReady(false);
  }, [videoBlobUrl]);

  /** Prime geo + camera in the same tap as Share (iOS Safari). */
  const openCaptureFromShareGesture = useCallback(() => {
    const geoPromise = primeGeolocationOnUserGesture();
    setReRecordLaunchGeo(null);
    setReRecordLaunchGeoResolved(false);
    setReRecordPrimedStream(null);
    setReRecordGesturePending(true);
    setShowQuickCapture(true);
    void geoPromise
      .then((g) => {
        setReRecordLaunchGeo(g);
        setReRecordLaunchGeoResolved(true);
        return primeCameraOnUserGesture();
      })
      .then((stream) => setReRecordPrimedStream(stream))
      .catch(() => setReRecordPrimedStream(null))
      .finally(() => setReRecordGesturePending(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    
    if (uploadMethod === 'file' && !formData.video_file && !formData.video_blob) {
      setError('Please select a video file');
      return;
    }
    
    if (uploadMethod === 'url' && !formData.video_url) {
      setError('Video URL is required');
      return;
    }

    if (showCaptionScreen && uploadMethod === 'file') {
      let resolved: { classificationId: string; contentFeed: 'main' | 'pre_post' };
      try {
        resolved = await resolveClassificationForPost();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Content classification failed');
        return;
      }

      const jobId = enqueueClipUpload(
        buildUploadPayload(resolved.classificationId, resolved.contentFeed),
      );
      if (!jobId) {
        setError('Too many clips are uploading. Wait for one to finish, then try again.');
        return;
      }
      skipNavVideoHydrationRef.current = true;
      setShowCaptionScreen(false);
      setShowQuickCapture(true);
      resetForNextCapture();
      openCaptureFromShareGesture();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let resolved: { classificationId: string; contentFeed: 'main' | 'pre_post' };
      try {
        resolved = await resolveClassificationForPost();
      } catch (e) {
        throw e;
      }

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
          thumbnailFile = await generateVideoThumbnailJpeg(fileToUpload);
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

      const showFields = clipShowFieldsForContentFeed(resolved.contentFeed, {
        artist_name: formData.artist_name,
        venue_name: formData.venue_name,
        location: formData.location,
        song_title: formData.song_title,
        genre_name: formData.genre_name,
        hashtagsInput: formData.hashtags,
        jambaseLink,
        eventTitleFallback:
          resolveClipEventTitle({
            artist_name: formData.artist_name,
            venue_name: formData.venue_name,
          }) ?? null,
      });

      // Prepare clip data based on upload type (Stream or R2)
      const clipData: any = {
        classification_id: resolved.classificationId,
        artist_name: showFields.artist_name,
        venue_name: showFields.venue_name,
        location: showFields.location,
        content_description: formData.content_description || null,
        hashtags: showFields.hashtags,
        song_title: showFields.song_title,
        genre_name: showFields.genre_name,
        status: 'published',
        timestamp: recordingAtIso || undefined,
        jambase_event_id: showFields.jambase_event_id ?? undefined,
        jambase_artist_id: showFields.jambase_artist_id ?? undefined,
        jambase_venue_id: showFields.jambase_venue_id ?? undefined,
        event_title: showFields.event_title ?? undefined,
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
        clipData.video_url =
          videoData.mp4PlaybackUrl || videoData.playbackUrl;
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

      await response.json();

      // Clean up blob URL if it exists
      if (videoBlobUrl) {
        URL.revokeObjectURL(videoBlobUrl);
        setVideoBlobUrl(null);
      }

      setShowCaptionScreen(false);
      setShowQuickCapture(false);

      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload clip');
    } finally {
      setLoading(false);
      setUploadProgress({ video: 0, thumbnail: 0 });
    }
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
    setJambaseLink(null);
    setResolveNotice(null);
    setRecordingAtIso(null);
    setCaptureGeo(null);
    setError(null);
    setCaptionVideoPlaying(false);
    setCaptionVideoMuted(true);
    captionCommittedArtistNameRef.current = '';
    auddAttemptedForSourceKeyRef.current = null;
    setAuddStatus('idle');
    setAuddMessage(null);
    navigate('/', { replace: true });
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

  if (isPending) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const wantQuickCaptureUrl = new URLSearchParams(location.search).get('quickCapture') === 'true';

  if (quickCaptureAwaitUserTap && wantQuickCaptureUrl && !showCaptionScreen) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center">
        <ClipUploadStatusBanner />
        <MapPin className="w-14 h-14 text-momentum-flare mb-4 shrink-0" aria-hidden />
        <h1 className="text-xl font-bold text-white mb-2">Location and camera</h1>
        <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
          Tap continue so your browser can ask for location (venue suggestions), then camera and microphone for your
          clip and song recognition.
        </p>
        {!isGeolocationSecureContext() && (
          <p className="text-momentum-glacier/90 text-xs max-w-sm mb-6 leading-relaxed">
            This page is not on HTTPS (or localhost). Chrome blocks location on insecure origins — use{' '}
            <span className="font-mono">https://</span> or <span className="font-mono">localhost</span> for location to
            work.
          </p>
        )}
        <button
          type="button"
          className="w-full max-w-xs px-6 py-4 rounded-xl momentum-grad-interactive text-white font-semibold active:scale-[0.98] transition-transform"
          onClick={() => {
            const geoPromise = primeGeolocationOnUserGesture();
            setReRecordLaunchGeo(null);
            setReRecordLaunchGeoResolved(false);
            setReRecordPrimedStream(null);
            setReRecordGesturePending(true);
            setShowQuickCapture(true);
            setQuickCaptureAwaitUserTap(false);
            void geoPromise
              .then((g) => {
                setReRecordLaunchGeo(g);
                setReRecordLaunchGeoResolved(true);
                return primeCameraOnUserGesture();
              })
              .then((stream) => setReRecordPrimedStream(stream))
              .catch(() => setReRecordPrimedStream(null))
              .finally(() => setReRecordGesturePending(false));
          }}
        >
          Continue
        </button>
        <button
          type="button"
          className="mt-6 text-gray-500 text-sm hover:text-gray-300"
          onClick={() => {
            setQuickCaptureAwaitUserTap(false);
            navigate({ pathname: '/upload', search: '' }, { replace: true, state: location.state });
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Show quick capture modal if requested
  if (showQuickCapture) {
    return (
      <div className="min-h-screen text-white">
        <ClipUploadStatusBanner />
        <QuickRecordButton
          isOpen={true}
          primedMediaStream={reRecordPrimedStream}
          gestureCameraPrimingPending={reRecordGesturePending}
          autoRequestCamera={!reRecordPrimedStream && !reRecordGesturePending}
          captureLaunchGeo={reRecordLaunchGeo}
          captureLaunchGeoResolved={reRecordLaunchGeoResolved}
          deferCameraUntilLaunchGeo
          onAfterCaptureNavigate={() => {
            reRecordPrimedStream?.getTracks().forEach((t) => t.stop());
            setReRecordPrimedStream(null);
            setReRecordGesturePending(false);
            setReRecordLaunchGeo(null);
            setReRecordLaunchGeoResolved(false);
            setShowQuickCapture(false);
          }}
          onClose={() => {
            reRecordPrimedStream?.getTracks().forEach((t) => t.stop());
            setReRecordPrimedStream(null);
            setReRecordGesturePending(false);
            setReRecordLaunchGeo(null);
            setReRecordLaunchGeoResolved(false);
            setShowQuickCapture(false);
            const sp = new URLSearchParams(location.search);
            if (sp.get('quickCapture') === 'true') {
              navigate({ pathname: '/upload', search: '' }, { replace: true, state: location.state });
            }
          }}
        />
      </div>
    );
  }

  // CAPTION SCREEN — post-capture review (same post flow as full "Share your moment" via handleSubmit)
  if (showCaptionScreen) {
    const isPrePostClip = isPrePostContentFeed(classifyResult?.content_feed);
    const showPerformanceCaptionDetails =
      classifyStatus === 'done' && classifyResult?.content_feed === 'main';
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const captionEventTitle = resolveClipEventTitle({
      event_title: jambaseLink?.eventTitle,
      artist_name: formData.artist_name,
      venue_name: formData.venue_name,
    });

    return (
      <div className="min-h-screen text-white">
        <ClipUploadStatusBanner />
        <Header />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2">
                {isPrePostClip ? 'Talking moment' : 'Share your moment'}
              </h1>
              <p className="text-gray-300 text-sm sm:text-lg">
                {isPrePostClip
                  ? 'Add a short description and post. This clip goes to your friends-only pre/post feed — we will not link it to an artist or venue.'
                  : classifyStatus === 'loading'
                    ? 'Checking whether this is a performance clip or a talking moment…'
                    : 'Add details and post. After you share, upload continues in the background so you can record your next clip right away.'}
                {!isPrePostClip && classifyStatus !== 'loading'
                  ? uploadSource === 'library'
                    ? ' We read date and location from your video file when available to find a matching show.'
                    : ' Venue and location are filled from GPS and JamBase when we find a match.'
                  : null}
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

          <div className="glass-panel rounded-xl overflow-hidden">
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
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
              {showPerformanceCaptionDetails && resolveNotice && (
                <div className="p-3 bg-momentum-ember/10 border border-momentum-ember/30 rounded-lg">
                  <p className="text-momentum-glacier/90 text-sm">{resolveNotice}</p>
                </div>
              )}
              {showPerformanceCaptionDetails && nearbyVenueChoices.length > 0 && (
                <div className="rounded-lg border border-white/15 bg-white/[0.06] p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Nearby venues</p>
                  <p className="text-xs text-gray-400">
                    Pick the venue you are at. We only auto-fill when you are within a quarter mile.
                  </p>
                  <div className="flex flex-col gap-2">
                    {nearbyVenueChoices.map((venue) => {
                      const selected =
                        formData.venue_name === venue.venue_name &&
                        jambaseLink?.venue === venue.jambase_venue_id;
                      const distLabel =
                        venue.distance_miles != null && Number.isFinite(venue.distance_miles)
                          ? `${venue.distance_miles.toFixed(2)} mi`
                          : null;
                      return (
                        <button
                          key={venue.jambase_venue_id ?? venue.venue_name ?? 'venue'}
                          type="button"
                          onClick={() => handleNearbyVenuePick(venue)}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                            selected
                              ? 'border-momentum-flare bg-momentum-flare/15'
                              : 'border-white/15 bg-white/5 hover:border-momentum-flare/50 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate">
                                {venue.venue_name ?? 'Venue'}
                              </p>
                              {venue.location ? (
                                <p className="text-xs text-gray-400 mt-0.5">{venue.location}</p>
                              ) : null}
                              {venue.artist_name ? (
                                <p className="text-xs text-momentum-rose mt-1">{venue.artist_name}</p>
                              ) : null}
                            </div>
                            {distLabel ? (
                              <span className="text-xs text-gray-500 shrink-0">{distLabel}</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {showPerformanceCaptionDetails && auddStatus === 'loading' && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg flex items-center gap-2 text-violet-100 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Identifying song (ACRCloud)…</span>
                </div>
              )}
              {showPerformanceCaptionDetails && auddStatus === 'done' && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                  <p className="text-violet-100 text-sm font-medium">
                    {auddMessage?.trim() || 'Song and artist prefilled below.'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Artist and song title are prefilled below — pick a JamBase artist if you want a verified link. Song
                    title is added as a tag for search.
                  </p>
                </div>
              )}
              {showPerformanceCaptionDetails && auddStatus === 'error' && auddMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm">{auddMessage}</p>
                </div>
              )}
              {classifyStatus === 'loading' && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center gap-2 text-sky-100 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Checking music match and speech (ACRCloud + Whisper)…</span>
                </div>
              )}
              {classifyStatus === 'done' && classifyMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-emerald-100 text-sm font-medium">{classifyMessage}</p>
                  {classifyResult?.content_feed === 'main' && classifyResult.acr_title ? (
                    <p className="text-gray-400 text-xs mt-1">
                      Matched: {classifyResult.acr_title}
                      {classifyResult.acr_artist ? ` — ${classifyResult.acr_artist}` : ''}
                    </p>
                  ) : null}
                </div>
              )}
              {classifyStatus === 'error' && classifyMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm">{classifyMessage}</p>
                </div>
              )}

              {showPerformanceCaptionDetails && (
              <div className="rounded-lg border border-white/15 bg-white/[0.06] p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-momentum-flare/90">
                  Show
                </div>
                {uploadSource === 'library' ? (
                  <p className="text-sm text-gray-400">
                    {libraryMetaReady
                      ? libraryFileMeta?.locationSource === 'embedded'
                        ? 'Matching show from GPS embedded in your video…'
                        : libraryFileMeta?.recordedAtIso
                          ? 'Using the video file date to find a show — add venue manually if needed.'
                          : 'Add artist and venue below, or pick from JamBase search results.'
                      : 'Reading date and location from your video file…'}
                  </p>
                ) : captionEventTitle ? (
                  <p className="text-lg sm:text-xl font-bold text-white leading-snug">{captionEventTitle}</p>
                ) : (
                  <p className="text-sm text-gray-400">
                    Event title will appear when we match your recording to a nearby show.
                  </p>
                )}
                {uploadSource !== 'library' ? (
                  <>
                    <div className="flex items-start gap-2 text-white border-t border-white/10 pt-3">
                      <MapPin className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{formData.venue_name || 'Venue not set yet'}</p>
                        <p className="text-sm text-gray-300 break-words">
                          {formData.location || 'Location will appear from your GPS or after you pick a show.'}
                        </p>
                      </div>
                    </div>
                    {formData.artist_name ? (
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Music className="w-4 h-4 text-momentum-rose shrink-0" />
                        <span>{formData.artist_name}</span>
                      </div>
                    ) : null}
                    <p className="text-xs text-gray-500">
                      Filled automatically when we match your recording to a nearby venue. Use &quot;Change
                      Artist/Venue&quot; below to edit.
                    </p>
                  </>
                ) : null}
              </div>
              )}

              {/* Caption Field */}
              <div>
                <label className="block text-gray-300 font-normal mb-2">
                  {isPrePostClip ? 'Description' : 'What was this moment?'}
                </label>
                <textarea
                  value={formData.content_description}
                  onChange={(e) => handleInputChange('content_description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                  placeholder="What was this moment?"
                />
                <p className="text-gray-400 text-xs mt-2">
                  {isPrePostClip ? 'Optional — tell your friends what this moment was about' : 'Caption is optional'}
                </p>
              </div>

              {showPerformanceCaptionDetails && auddStatus !== 'loading' && (
                <div
                  className={
                    shouldShowManualSongTitleEntry(auddStatus)
                      ? 'rounded-lg border border-momentum-flare/40 bg-momentum-flare/5 p-4 space-y-2'
                      : 'space-y-2'
                  }
                >
                  <label
                    htmlFor="caption-song-title"
                    className={
                      shouldShowManualSongTitleEntry(auddStatus)
                        ? 'flex items-center gap-2 text-white font-medium'
                        : 'block text-gray-300 font-normal'
                    }
                  >
                    {shouldShowManualSongTitleEntry(auddStatus) && (
                      <Disc3 className="w-5 h-5 text-momentum-flare shrink-0" aria-hidden />
                    )}
                    Song title{' '}
                    <span className="text-gray-500 font-normal text-sm">(optional)</span>
                  </label>
                  <input
                    id="caption-song-title"
                    type="text"
                    value={formData.song_title}
                    onChange={(e) => handleInputChange('song_title', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/25 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                    placeholder={
                      auddStatus === 'done' ? 'What song was playing?' : 'Enter the song name'
                    }
                    autoComplete="off"
                  />
                  {auddStatus === 'done' ? (
                    <p className="text-gray-400 text-xs">
                      Adds a tag for search (along with artist and venue). Leave blank if you prefer.
                    </p>
                  ) : (
                    <p className="text-gray-400 text-xs">Optional — adds a tag so fans can find your clip.</p>
                  )}
                </div>
              )}

              {showPerformanceCaptionDetails && (
              <div>
                <label className="block text-gray-300 font-normal mb-2">
                  Genre <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <select
                  value={formData.genre_name}
                  onChange={(e) => handleInputChange('genre_name', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-flare transition-colors"
                >
                  <option value="" className="bg-slate-900">
                    Select a genre
                  </option>
                  {CLIP_GENRE_OPTIONS.map((genre) => (
                    <option key={genre} value={genre} className="bg-slate-900">
                      {genre}
                    </option>
                  ))}
                </select>
                <p className="text-gray-400 text-xs mt-2">
                  Tags this clip with a genre hub page fans can browse.
                </p>
              </div>
              )}

              {showPerformanceCaptionDetails && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-white font-medium">Tags</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingTags) {
                        setIsEditingTags(false);
                      } else {
                        beginEditingTags();
                      }
                    }}
                    className="flex items-center space-x-2 text-momentum-flare hover:text-momentum-flare/90 transition-colors text-sm"
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
                    {/* Artist — JamBase search + pick only (mobile caption) */}
                    <div className="relative">
                      <label className="block text-gray-400 text-xs mb-1 font-medium">
                        Artist <span className="text-gray-500 font-normal">(JamBase)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={artistSearch}
                          onChange={(e) => handleCaptionArtistSearchChange(e.target.value)}
                          onFocus={releaseArtistAutocompleteLock}
                          autoComplete="off"
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare text-sm"
                          placeholder="Search JamBase artists"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-momentum-rose pointer-events-none" />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Search JamBase or type an artist name — pick a result for a verified link.
                      </p>

                      {showArtistSuggestions && debouncedArtistSearch.length >= 2 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-momentum-ember/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {artistSearchPending ? (
                            <div className="px-3 py-3 flex items-center gap-2 text-gray-300 text-sm">
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              Searching JamBase…
                            </div>
                          ) : artistSuggestions.length > 0 ? (
                            artistSuggestions.map((artist) => (
                              <button
                                key={artist.identifier}
                                type="button"
                                onClick={() => handleArtistSelect(artist)}
                                className="w-full px-3 py-2 text-left hover:bg-momentum-ember/20 transition-colors border-b border-white/10 last:border-0"
                              >
                                <div className="text-white text-sm font-medium">{artist.name}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-400 text-sm">
                              No artists match that search. Try a different spelling or name.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Venue — JamBase search + pick only (mobile caption) */}
                    <div className="relative">
                      <label className="block text-gray-400 text-xs mb-1 font-medium">
                        Venue <span className="text-gray-500 font-normal">(JamBase)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={venueSearch}
                          onChange={(e) => handleCaptionVenueSearchChange(e.target.value)}
                          onFocus={releaseVenueAutocompleteLock}
                          autoComplete="off"
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare text-sm"
                          placeholder="Search JamBase venues"
                        />
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Search JamBase or type a venue name — pick a result for a verified link.
                      </p>

                      {showVenueSuggestions && debouncedVenueSearch.length >= 2 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-momentum-ember/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {venueSearchPending ? (
                            <div className="px-3 py-3 flex items-center gap-2 text-gray-300 text-sm">
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              Searching JamBase…
                            </div>
                          ) : venueSuggestions.length > 0 ? (
                            venueSuggestions.map((venue) => (
                              <button
                                key={venue.identifier}
                                type="button"
                                onClick={() => handleVenueSelect(venue)}
                                className="w-full px-3 py-2 text-left hover:bg-momentum-ember/20 transition-colors border-b border-white/10 last:border-0"
                              >
                                <div className="text-white text-sm font-medium">{venue.name}</div>
                                {venue.location?.city && (
                                  <div className="text-xs text-gray-400">
                                    {venue.location.city}
                                    {venue.location.state ? `, ${venue.location.state}` : ''}
                                  </div>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-400 text-sm">
                              No venues match that search. Try a different spelling or name.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Location */}
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare text-sm"
                        placeholder="Location"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-momentum-flare" />
                    </div>
                  </div>
                ) : (
                  /* Tag Display */
                  <div className="bg-white/5 rounded-lg p-4 space-y-2">
                    {captionEventTitle ? (
                      <p className="text-base font-bold text-white leading-snug">{captionEventTitle}</p>
                    ) : null}
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Music className="w-4 h-4 text-momentum-rose" />
                      <span className="text-sm">{formData.artist_name || 'Artist not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <Disc3 className="w-4 h-4 text-momentum-flare-400 shrink-0" />
                      <span className="text-sm">{formData.song_title?.trim() ? formData.song_title : 'Song not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="text-sm">{formData.venue_name || 'Venue not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-momentum-flare" />
                      <span className="text-sm">{formData.location || 'Location not set'}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400 text-xs pt-1 border-t border-white/10">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>Recorded {currentDate}</span>
                    </div>
                  </div>
                )}
              </div>
              )}

              {showPerformanceCaptionDetails && (
              <div>
                <label className="block text-gray-300 font-normal mb-2">Hashtags</label>
                <input
                  type="text"
                  value={formData.hashtags}
                  onChange={(e) => handleInputChange('hashtags', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare transition-colors"
                  placeholder="#rock #livemusic #concert"
                />
                <p className="text-gray-400 text-xs mt-2">Separate with spaces (optional)</p>
              </div>
              )}

              <div className="space-y-3 pt-4">
                <button
                  type="button"
                  disabled={
                    classifyStatus === 'loading' ||
                    classifyStatus === 'error' ||
                    loading
                  }
                  onClick={() => void handleSubmit(null)}
                  className="w-full px-6 py-4 md:px-[1.65rem] md:py-[1.1rem] momentum-grad-interactive rounded-xl font-bold text-white text-lg md:text-[1.2375rem] hover:scale-[1.02] md:hover:scale-[1.12] transition-transform active:scale-[0.98] shadow-lg shadow-momentum-ember/35 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {classifyStatus === 'loading'
                    ? 'Checking clip…'
                    : isPrePostClip
                      ? 'Share talking moment'
                      : 'Share your moment'}
                </button>
                <p className="text-center text-xs text-gray-500">
                  Your clip uploads in the background — you can record again immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FULL UPLOAD FORM - Original interface
  return (
    <div className="min-h-screen text-white">
      <ClipUploadStatusBanner />
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

        <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          {resolveNotice && (
            <div className="p-3 bg-momentum-ember/10 border border-momentum-ember/30 rounded-lg">
              <p className="text-momentum-glacier/90 text-sm">{resolveNotice}</p>
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
                    ? 'momentum-grad-interactive text-white'
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
                    ? 'momentum-grad-interactive text-white'
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
                <Film className="w-5 h-5 text-momentum-flare" />
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
                  <Upload className="w-8 h-8 text-momentum-flare" />
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
                      className="bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember h-2 rounded-full transition-all"
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
                <Film className="w-5 h-5 text-momentum-flare" />
                <span>Video URL *</span>
              </label>
              <input
                type="url"
                value={formData.video_url}
                onChange={(e) => handleInputChange('video_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
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
                <ImageIcon className="w-5 h-5 text-momentum-flare" />
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
                  <ImageIcon className="w-8 h-8 text-momentum-flare" />
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
                      className="bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember h-2 rounded-full transition-all"
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
                <ImageIcon className="w-5 h-5 text-momentum-flare" />
                <span>Thumbnail URL (optional)</span>
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) => handleInputChange('thumbnail_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                placeholder="https://example.com/thumbnail.jpg"
              />
            </div>
          )}

          {/* Artist Name with Autocomplete */}
          <div className="relative">
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Music className="w-5 h-5 text-momentum-rose" />
              <span>Artist Name</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={artistSearch}
                onChange={(e) => handleCaptionArtistSearchChange(e.target.value)}
                onFocus={releaseArtistAutocompleteLock}
                className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                placeholder="Taylor Swift"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              {jambaseLoading && (
                <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-momentum-flare animate-spin" />
              )}
            </div>
            
            {/* Artist Suggestions Dropdown */}
            {showArtistSuggestions && artistSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-momentum-ember/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {artistSuggestions.map((artist) => (
                  <button
                    key={artist.identifier}
                    type="button"
                    onClick={() => handleArtistSelect(artist)}
                    className="w-full px-4 py-3 text-left hover:bg-momentum-ember/20 transition-colors border-b border-white/10 last:border-0"
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
              <p className="text-gray-400 text-sm mt-2">
                Search JamBase or type an artist name — pick a result for a verified link.
              </p>
          </div>

          {/* Song title (optional) — adds hashtag token for search when AudD or user fills it */}
          <div>
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Disc3 className="w-5 h-5 text-momentum-flare-400" />
              <span>
                Song title <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </span>
            </label>
            <input
              type="text"
              value={formData.song_title}
              onChange={(e) => handleInputChange('song_title', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
              placeholder="Adds a searchable tag (e.g. after AudD or if you know the tune)"
            />
          </div>

          {/* Venue and Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="flex items-center space-x-2 text-white font-medium mb-2">
                <Calendar className="w-5 h-5 text-momentum-flare" />
                <span>
                  Venue Name <span className="text-gray-400 font-normal text-sm">(JamBase)</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={venueSearch}
                  onChange={(e) => handleCaptionVenueSearchChange(e.target.value)}
                  onFocus={releaseVenueAutocompleteLock}
                  autoComplete="off"
                  className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                  placeholder="Search JamBase venues"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                {venueSearchPending && (
                  <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-momentum-flare animate-spin" />
                )}
              </div>

              {showVenueSuggestions && debouncedVenueSearch.length >= 2 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-momentum-ember/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {venueSearchPending ? (
                    <div className="px-4 py-3 flex items-center gap-2 text-gray-300 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      Searching JamBase…
                    </div>
                  ) : venueSuggestions.length > 0 ? (
                    venueSuggestions.map((venue) => (
                      <button
                        key={venue.identifier}
                        type="button"
                        onClick={() => handleVenueSelect(venue)}
                        className="w-full px-4 py-3 text-left hover:bg-momentum-ember/20 transition-colors border-b border-white/10 last:border-0"
                      >
                        <div className="text-white font-medium">{venue.name}</div>
                        {venue.location?.city && (
                          <div className="text-sm text-gray-400">
                            {venue.location.city}
                            {venue.location.state ? `, ${venue.location.state}` : ''}
                          </div>
                        )}
                        {venue.capacity && (
                          <div className="text-xs text-gray-500">
                            Capacity: {venue.capacity.toLocaleString()}
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-400 text-sm">
                      No venues match that search. Try a different spelling or name.
                    </div>
                  )}
                </div>
              )}
              <p className="text-gray-400 text-sm mt-2">
                Search JamBase or type a venue name — pick a result for a verified link.
              </p>
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
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
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
              placeholder="Tell everyone about this epic moment..."
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Hash className="w-5 h-5 text-momentum-ember" />
              <span>Hashtags</span>
            </label>
            <input
              type="text"
              value={formData.hashtags}
              onChange={(e) => handleInputChange('hashtags', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
              placeholder="#rock #livemusic #concert"
            />
            <p className="text-gray-400 text-sm mt-2">Separate hashtags with spaces (e.g., #rock #pop #concert)</p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-4 bg-black/30 border border-momentum-ember/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
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
    </div>
  );
}
