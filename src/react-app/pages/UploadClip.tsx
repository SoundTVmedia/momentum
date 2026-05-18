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
  identifyMusicWithAudD,
  type AudDNavPrefill,
} from '@/react-app/utils/auddIdentify';
import type { JamBaseArtist, JamBaseVenue, ClipShowCandidate } from '@/shared/types';

import { buildHashtagsArrayForPost } from '@/shared/clip-hashtags';

export default function UploadClip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPending } = useAuth();
  const { searchArtists, searchVenues, loading: jambaseLoading } = useJamBase();
  const { getDeviceCoordinates, location: lastKnownGeo, ingestCaptureGeo } = useGeolocation();
  const { setHideBottomNav } = useMobileChrome();
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

  /** Mobile caption artist field: last name chosen from JamBase (or auto-tag); typing away clears until re-selected. */
  const captionCommittedArtistNameRef = useRef('');

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

  const [jambaseLink, setJambaseLink] = useState<{
    event: string | null;
    artist: string | null;
    venue: string | null;
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

  /** [AudD](https://docs.audd.io/) song ID on the post-capture screen (short snippet from the clip). */
  const [auddStatus, setAuddStatus] = useState<
    'idle' | 'loading' | 'done' | 'skipped' | 'nomatch' | 'error'
  >('idle');
  const [auddMessage, setAuddMessage] = useState<string | null>(null);
  const auddAttemptedForSourceKeyRef = useRef<string | null>(null);

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

  // Open quick capture when ?quickCapture=true — needs an explicit Continue tap for location (iOS gesture policy).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantCapture = params.get('quickCapture') === 'true';
    if (!wantCapture) {
      setShowQuickCapture(false);
      setReRecordLaunchGeo(null);
      setReRecordLaunchGeoResolved(false);
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

      if (showData.artist_name) {
        const an = String(showData.artist_name);
        setArtistSearch(an);
        captionCommittedArtistNameRef.current = an;
      }
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

    // AudD ran in QuickRecord before navigate — apply prefill and skip a duplicate identify on the caption screen.
    const navWithAudD = location.state as { auddPrefill?: AudDNavPrefill } | null | undefined;
    const ap = navWithAudD?.auddPrefill;
    if (ap?.sourceKey) {
      auddAttemptedForSourceKeyRef.current = ap.sourceKey;
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
          setAuddStatus('nomatch');
          setAuddMessage(null);
        }
      } else if (ap.status === 'skipped') {
        setAuddStatus('skipped');
        setAuddMessage(ap.message);
      } else if (ap.status === 'nomatch') {
        setAuddStatus('nomatch');
        setAuddMessage(null);
      } else if (ap.status === 'error') {
        setAuddStatus('error');
        setAuddMessage(ap.message ?? 'Song lookup failed');
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
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  // Search for artists
  useEffect(() => {
    if (debouncedArtistSearch && debouncedArtistSearch.length >= 2) {
      setArtistSearchPending(true);
      searchArtists(debouncedArtistSearch)
        .then((results) => {
          setArtistSuggestions(results);
          setShowArtistSuggestions(results.length > 0);
        })
        .finally(() => setArtistSearchPending(false));
    } else {
      setArtistSuggestions([]);
      setShowArtistSuggestions(false);
      setArtistSearchPending(false);
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

  // Keep caption search field aligned with committed tags when not editing (mobile).
  useEffect(() => {
    if (!showCaptionScreen || isEditingTags) return;
    setArtistSearch(formData.artist_name);
    setShowArtistSuggestions(false);
  }, [showCaptionScreen, isEditingTags, formData.artist_name]);

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
    captionCommittedArtistNameRef.current = c.artist_name ?? '';
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

    if (resolveForFile && (jambaseLink?.event || jambaseLink?.venue)) return;

    const at =
      recordingAtIso ||
      (formData.video_file ? new Date(formData.video_file.lastModified).toISOString() : null) ||
      (typeof nav?.recordingStartedAt === 'string' ? nav.recordingStartedAt : null) ||
      new Date().toISOString();

    let cancelled = false;
    (async () => {
      let geo = captureGeo;
      if (
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

        if (fromQuick && !cancelled) {
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

        if (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) {
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

        const applyClosest = () => {
          if (data.match === 'single' && data.candidates?.[0]) {
            applyClipCandidate(data.candidates[0]);
            setResolveNotice(null);
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
  ]);

  /** AudD when caption opens without pre-navigate identify (e.g. deep link with blob only). */
  useEffect(() => {
    if (!showCaptionScreen || !user || isPending) return;
    const source = formData.video_blob ?? formData.video_file;
    if (!source || !(source instanceof Blob)) return;

    const sourceKey = auddSourceKey(source);
    if (auddAttemptedForSourceKeyRef.current === sourceKey) return;
    auddAttemptedForSourceKeyRef.current = sourceKey;

    let cancelled = false;
    setAuddStatus('loading');
    setAuddMessage(null);

    void (async () => {
      const result = await identifyMusicWithAudD(source);
      if (cancelled) return;

      if (result.status === 'skipped') {
        setAuddStatus('skipped');
        setAuddMessage(
          typeof result.message === 'string' && result.message.trim() !== ''
            ? result.message
            : 'Song lookup was skipped.',
        );
        return;
      }
      if (result.status === 'error') {
        setAuddStatus('error');
        setAuddMessage(result.message);
        return;
      }
      if (result.status === 'nomatch') {
        setAuddStatus('nomatch');
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
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArtistSelect = (artist: JamBaseArtist) => {
    captionCommittedArtistNameRef.current = artist.name;
    setFormData((prev) => ({ ...prev, artist_name: artist.name }));
    setArtistSearch(artist.name);
    setShowArtistSuggestions(false);
    setJambaseLink((prev) => ({
      event: null,
      artist: artist.identifier,
      venue: prev?.venue ?? null,
    }));
  };

  const handleCaptionArtistSearchChange = (value: string) => {
    setArtistSearch(value);
    if (value.trim() === '') {
      captionCommittedArtistNameRef.current = '';
      setFormData((prev) => ({ ...prev, artist_name: '' }));
      setJambaseLink((prev) => (prev ? { ...prev, artist: null, event: null } : null));
      return;
    }
    if (value !== captionCommittedArtistNameRef.current) {
      captionCommittedArtistNameRef.current = '';
      setFormData((prev) => ({ ...prev, artist_name: '' }));
      setJambaseLink((prev) => (prev ? { ...prev, artist: null, event: null } : null));
    }
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

      const hashtagsArray = buildHashtagsArrayForPost(
        formData.hashtags,
        formData.artist_name,
        formData.song_title,
      );

      // Prepare clip data based on upload type (Stream or R2)
      const clipData: any = {
        artist_name: formData.artist_name || null,
        venue_name: formData.venue_name || null,
        location: formData.location || null,
        content_description: formData.content_description || null,
        hashtags: hashtagsArray,
        song_title: formData.song_title?.trim() || null,
        status: 'published',
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <MapPin className="w-14 h-14 text-cyan-400 mb-4 shrink-0" aria-hidden />
        <h1 className="text-xl font-bold text-white mb-2">Location and camera</h1>
        <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
          Tap continue so your browser can ask for location (venue suggestions), then camera and microphone for your
          clip and song recognition.
        </p>
        {!isGeolocationSecureContext() && (
          <p className="text-amber-200/90 text-xs max-w-sm mb-6 leading-relaxed">
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
      <div className="min-h-screen bg-black">
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

          <div className="bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl overflow-hidden">
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
              {resolveNotice && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-200 text-sm">{resolveNotice}</p>
                </div>
              )}
              {auddStatus === 'loading' && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg flex items-center gap-2 text-violet-100 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Identifying music in your clip (AudD)…</span>
                </div>
              )}
              {auddStatus === 'done' && (
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
              {auddStatus === 'skipped' && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-gray-300 text-sm">
                    {auddMessage?.trim() ||
                      'Song lookup was skipped. Add AUDD_API_TOKEN to your worker env (e.g. .dev.vars) to enable AudD.'}
                  </p>
                </div>
              )}
              {auddStatus === 'nomatch' && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-gray-400 text-sm">No commercial match for this audio (AudD).</p>
                  <p className="text-gray-500 text-xs mt-2">
                    Optional: add the song title below — we&apos;ll tag it for search. Not required to post.
                  </p>
                </div>
              )}
              {auddStatus === 'error' && auddMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm">{auddMessage}</p>
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
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint transition-colors"
                  placeholder="What was this moment?"
                />
                <p className="text-gray-400 text-xs mt-2">Caption is optional</p>
              </div>

              {/* Song title — optional; prefilled when AudD matches; adds a searchable tag */}
              <div>
                <label className="block text-gray-300 font-normal mb-2">
                  Song title <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.song_title}
                  onChange={(e) => handleInputChange('song_title', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint transition-colors"
                  placeholder="What song was playing?"
                />
                <p className="text-gray-400 text-xs mt-2">
                  Adds a tag for search (along with artist and venue). Leave blank if you prefer.
                </p>
              </div>

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
                          onFocus={() => {
                            if (debouncedArtistSearch.length >= 2) setShowArtistSuggestions(true);
                          }}
                          autoComplete="off"
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint text-sm"
                          placeholder="Search JamBase artists"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        Pick an artist from the results — free-text names are not saved for this field.
                      </p>

                      {debouncedArtistSearch.length >= 2 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-momentum-teal/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
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
                                className="w-full px-3 py-2 text-left hover:bg-cyan-500/20 transition-colors border-b border-white/10 last:border-0"
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
                          className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint text-sm"
                          placeholder="Venue name"
                        />
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
                      </div>
                      
                      {showVenueSuggestions && venueSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-momentum-teal/30 rounded-lg shadow-xl max-h-48 overflow-y-auto">
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
                        className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint text-sm"
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
                      <Disc3 className="w-4 h-4 text-fuchsia-400 shrink-0" />
                      <span className="text-sm">{formData.song_title?.trim() ? formData.song_title : 'Song not set'}</span>
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
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint transition-colors"
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
                          className="h-full bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal transition-all duration-300"
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
                          className="h-full bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal transition-all duration-300"
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
                  onClick={() => handleSubmit(null)}
                  disabled={loading}
                  className="w-full px-6 py-4 momentum-grad-interactive rounded-xl font-bold text-white text-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-momentum-teal/35"
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
              </div>
            </div>
          </div>
        </div>
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

        <form onSubmit={handleSubmit} className="bg-black/40 backdrop-blur-lg border border-momentum-teal/20 rounded-xl p-8 space-y-6">
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
                      className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal h-2 rounded-full transition-all"
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
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
                      className="bg-gradient-to-r from-momentum-teal via-momentum-mint to-momentum-teal h-2 rounded-full transition-all"
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
                placeholder="https://example.com/thumbnail.jpg"
              />
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
                className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
                placeholder="Taylor Swift"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              {jambaseLoading && (
                <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>
            
            {/* Artist Suggestions Dropdown */}
            {showArtistSuggestions && artistSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-momentum-teal/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
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

          {/* Song title (optional) — adds hashtag token for search when AudD or user fills it */}
          <div>
            <label className="flex items-center space-x-2 text-white font-medium mb-2">
              <Disc3 className="w-5 h-5 text-fuchsia-400" />
              <span>
                Song title <span className="text-gray-400 font-normal text-sm">(optional)</span>
              </span>
            </label>
            <input
              type="text"
              value={formData.song_title}
              onChange={(e) => handleInputChange('song_title', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
              placeholder="Adds a searchable tag (e.g. after AudD or if you know the tune)"
            />
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
                  className="w-full px-4 py-3 pr-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
                  placeholder="Madison Square Garden"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              
              {/* Venue Suggestions Dropdown */}
              {showVenueSuggestions && venueSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-momentum-teal/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
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
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
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
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
              placeholder="#rock #livemusic #concert"
            />
            <p className="text-gray-400 text-sm mt-2">Separate hashtags with spaces (e.g., #rock #pop #concert)</p>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-4 bg-black/30 border border-momentum-teal/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all"
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
