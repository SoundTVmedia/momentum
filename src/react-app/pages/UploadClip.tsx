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
  shouldUseNativeIosCapture,
  restoreNativeMediaPlaybackAudio,
  isBlobObjectUrl,
  nativeCapturePreviewVideoUrl,
  resolveNativeCaptureUploadBlob,
  assertCaptureBlobHasAudio,
} from '@/react-app/lib/native-capture';
import {
  primeGeolocationOnUserGesture,
  isGeolocationSecureContext,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { useQuickCapture } from '@/react-app/contexts/QuickCaptureContext';
import { generateVideoThumbnailJpeg } from '@/react-app/utils/videoThumbnail';
import { playVideoWithSoundOnGesture } from '@/react-app/utils/videoAutoplay';
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
import { isPrePostContentFeed } from '@/shared/pre-post-clip';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import type { ClipUploadJobPayload } from '@/react-app/lib/processClipUpload';
import { resolveEnqueueClassification } from '@/react-app/lib/upload-outbox/enqueue-classification';
import {
  clearPendingCapture,
  clearPendingCaptureMemory,
  invalidatePendingCaptureFlush,
  loadPendingCapture,
  persistClipLocallyOnCapture,
  resolvePendingCaptureForReview,
  PENDING_CAPTURE_JOB_ID,
} from '@/react-app/lib/upload-outbox/capture-local-save';
import { blobSourceKey } from '@/react-app/lib/upload-outbox/gallery-save';
import {
  hasPrimedPendingCapture,
  wantsCaptureReviewScreen,
  isQuickCaptureReviewFlow,
  readCaptureHandoffMeta,
  PENDING_CAPTURE_READY_EVENT,
  markCaptureDiscarded,
  blockCaptureReviewRecovery,
  isCaptureBlobConsumed,
  isCaptureReviewRecoveryBlocked,
  isCaptureReviewSessionBlocked,
  markCaptureSharedForBlob,
  markRecordingStartedAtShared,
  allowCaptureReviewRecovery,
  hasPendingCaptureReviewHandoff,
  clearPendingCaptureReviewHandoff,
  isActiveCaptureHandoff,
  primePendingCaptureVideo,
  shouldHydrateCaptureReview,
  shouldSkipCaptureReviewHydration,
  wasCaptureRecentlyShared,
  wasBlobRecentlyShared,
  wasRecordingStartedAtShared,
} from '@/react-app/lib/upload-outbox/capture-handoff';
import { peekCachedOutboxBlobs } from '@/react-app/lib/upload-outbox/blob-store';
import {
  captionDraftMatchesVideo,
  clearCaptionDraft,
  loadCaptionDraft,
  saveCaptionDraft,
} from '@/react-app/lib/upload-outbox/caption-draft';
import {
  classifyContentFeedForClip,
  contentFeedUserMessage,
} from '@/react-app/utils/classifyContentFeed';
import {
  BYPASS_CONTENT_FEED_BIFURCATION,
  classifyContentFeed,
  hasManualShowArtistVenue,
  type ContentFeedClassification,
} from '@/shared/content-feed';
import {
  extractVideoFileMetadata,
  type ExtractedVideoFileMetadata,
} from '@/react-app/utils/extractVideoFileMetadata';
import {
  captureShowCandidateFromPostedClip,
  clipShowCandidateToNavState,
  clearCaptureShowSession,
  loadCaptureShowSession,
  loadStickyCaptureShowSession,
  markCaptureShowSessionPosted,
  saveCaptureShowSession,
  stickyUploadFormPatch,
} from '@/react-app/utils/captureShowSession';
import { useShowMarks } from '@/react-app/hooks/useShowMarks';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';
import {
  jamBaseEventToShowMarkInput,
  pickShowMarkForLibraryUpload,
  showMarkToClipCandidate,
} from '@/shared/show-marks';
import { resolveShowAutoApplyCandidate, resolveCameraGoingAutoFill } from '@/shared/clip-resolve-show-match';

function isoToDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function dateInputValueToIso(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function clipManualShowPostReady(formData: { artist_name: string; venue_name: string }): boolean {
  return hasManualShowArtistVenue(formData.artist_name, formData.venue_name);
}

export default function UploadClip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPending } = useAuth();
  const { searchArtists, searchVenues, loading: jambaseLoading } = useJamBase();
  const { getDeviceCoordinates, location: lastKnownGeo, ingestCaptureGeo } = useGeolocation();
  const { setHideBottomNav } = useMobileChrome();
  const quickCapture = useQuickCapture();
  const { enqueue: enqueueClipUpload, activeCount: clipUploadsInFlight, jobs: clipUploadJobs } =
    useClipUploadQueue();
  const isMobile = useIsMobileViewport();
  const { captureMarks, hydrated: showMarksHydrated } = useShowMarks();
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const galleryCaptureKeyRef = useRef<string | null>(null);
  const nativeVideoUriRef = useRef<string | null>(null);

  const clearLocalCaptureDraft = useCallback(async (opts?: { discarded?: boolean; shared?: boolean; video?: Blob | null }) => {
    const nativePath = nativeVideoUriRef.current;
    galleryCaptureKeyRef.current = null;
    nativeVideoUriRef.current = null;
    if (opts?.discarded) {
      markCaptureDiscarded();
    }
    if (opts?.shared) {
      blockCaptureReviewRecovery();
      if (opts.video?.size) {
        markCaptureSharedForBlob(opts.video, nativePath);
      } else {
        markCaptureSharedForBlob(new Blob(), nativePath);
      }
    }
    await clearPendingCapture();
    await clearCaptionDraft();
  }, []);

  /** Post-capture review (Share your moment) — open immediately when landing with a recorded blob/file. */
  const [showCaptionScreen, setShowCaptionScreen] = useState(() => {
    if (shouldSkipCaptureReviewHydration()) return false;
    if (isCaptureReviewRecoveryBlocked() || wasCaptureRecentlyShared()) return false;
    const handoffAt = readCaptureHandoffMeta()?.recordingStartedAt;
    if (wasRecordingStartedAtShared(handoffAt)) return false;
    if (!shouldHydrateCaptureReview(handoffAt)) return false;
    if (!wantsCaptureReviewScreen(location.search) && !hasPrimedPendingCapture()) {
      const s = location.state as {
        videoBlob?: unknown;
        videoFile?: unknown;
        fromQuickCapture?: boolean;
        recordingStartedAt?: string;
      } | null | undefined;
      if (!(s?.videoBlob ?? s?.videoFile ?? s?.fromQuickCapture ?? s?.recordingStartedAt)) {
        return false;
      }
    }
    if (wantsCaptureReviewScreen(location.search)) return true;
    const s = location.state as {
      videoBlob?: unknown;
      videoFile?: unknown;
      fromQuickCapture?: boolean;
      recordingStartedAt?: string;
    } | null | undefined;
    if (s?.videoBlob ?? s?.videoFile ?? s?.fromQuickCapture ?? s?.recordingStartedAt) {
      return true;
    }
    return hasPrimedPendingCapture();
  });

  /** JamBase pick committed in caption/tags editor — keeps autocomplete closed until the user edits again. */
  const captionCommittedArtistNameRef = useRef('');
  const captionCommittedVenueNameRef = useRef('');
  /** After Share — ignore stale `location.state` video until a new recording navigates here. */
  const skipNavVideoHydrationRef = useRef(shouldSkipCaptureReviewHydration());
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
  const [capturePrepareTimedOut, setCapturePrepareTimedOut] = useState(false);

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

  const assignCapturePreviewVideo = useCallback((blob: Blob, nativePath?: string | null) => {
    setVideoBlobUrl((prev) => {
      if (prev && isBlobObjectUrl(prev)) URL.revokeObjectURL(prev);
      return nativeCapturePreviewVideoUrl(nativePath) ?? URL.createObjectURL(blob);
    });
  }, []);

  const revokeCapturePreviewVideo = useCallback((url: string | null | undefined) => {
    if (url && isBlobObjectUrl(url)) URL.revokeObjectURL(url);
  }, []);

  /** After Share/upload, leave /upload?reviewCapture without reopening a stale caption screen. */
  const leaveReviewCaptureRouteAfterShare = useCallback(() => {
    setShowCaptionScreen(false);
    setQuickCaptureAwaitUserTap(false);
    if (isMobile) {
      allowCaptureReviewRecovery();
      setReRecordPrimedStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setReRecordGesturePending(false);
      setReRecordLaunchGeo(null);
      setReRecordLaunchGeoResolved(false);
      setShowQuickCapture(false);
      navigate({ pathname: '/', search: '' }, { replace: true, state: null });
      // Global overlay sits outside app-route-outlet — feed stays visible when the user dismisses capture.
      queueMicrotask(() => quickCapture.openQuickCapture());
      return;
    }
    setShowQuickCapture(false);
    navigate({ pathname: '/', search: '' }, { replace: true, state: null });
  }, [isMobile, navigate, quickCapture]);

  useEffect(() => {
    if (location.pathname !== '/upload') return;
    if (!wantsCaptureReviewScreen(location.search)) return;

    const handoffAt = readCaptureHandoffMeta()?.recordingStartedAt;
    if (hasPendingCaptureReviewHandoff(handoffAt)) {
      skipNavVideoHydrationRef.current = false;
      return;
    }

    if (skipNavVideoHydrationRef.current) {
      // Post-Share guard — strip stale reviewCapture only, never a fresh capture handoff.
      navigate({ pathname: '/upload', search: '' }, { replace: true, state: null });
      return;
    }
    if (
      shouldSkipCaptureReviewHydration() ||
      isCaptureReviewSessionBlocked() ||
      !shouldHydrateCaptureReview(handoffAt)
    ) {
      skipNavVideoHydrationRef.current = true;
      leaveReviewCaptureRouteAfterShare();
    }
  }, [location.pathname, location.search, navigate, leaveReviewCaptureRouteAfterShare]);

  /** Close caption if post-Share guards are active (covers late IDB hydration after upload). */
  useEffect(() => {
    if (!showCaptionScreen) return;
    if (isActiveCaptureHandoff()) return;
    if (!shouldSkipCaptureReviewHydration() && !isCaptureReviewSessionBlocked()) return;
    skipNavVideoHydrationRef.current = true;
    if (location.pathname === '/upload' && wantsCaptureReviewScreen(location.search)) {
      leaveReviewCaptureRouteAfterShare();
      return;
    }
    setShowCaptionScreen(false);
  }, [
    showCaptionScreen,
    location.pathname,
    location.search,
    leaveReviewCaptureRouteAfterShare,
  ]);

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
  /** True while resolve-show (or library metadata read) is in flight for the Show panel. */
  const [showResolveLoading, setShowResolveLoading] = useState(false);
  /** 0–100 while show matching runs; drives the Show panel progress bar. */
  const [showResolveProgress, setShowResolveProgress] = useState(0);
  /** Top nearby venues when auto-apply is skipped (wrong day or >2 mi). */
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

  /** Apply GPS from navigation / handoff before paint so resolve-show sees coords on first run. */
  useLayoutEffect(() => {
    const handoff = readCaptureHandoffMeta();
    const nav = location.state as {
      captureGeo?: {
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
        country: string | null;
      };
    } | null | undefined;
    const cg = nav?.captureGeo ?? handoff?.captureGeo;
    if (!cg || !Number.isFinite(cg.latitude) || !Number.isFinite(cg.longitude)) return;
    setCaptureGeo(cg);
  }, [location.state, location.search]);

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

  /** Close caption if this clip was already shared / uploaded (guards late hydration on iOS). */
  useEffect(() => {
    if (!showCaptionScreen) return;
    const video = formData.video_blob;
    if (video?.size && isCaptureBlobConsumed(video)) {
      setShowCaptionScreen(false);
      setFormData((prev) => ({ ...prev, video_blob: null }));
      if (videoBlobUrl) {
        revokeCapturePreviewVideo(videoBlobUrl);
        setVideoBlobUrl(null);
      }
    }
  }, [showCaptionScreen, formData.video_blob, clipUploadJobs, videoBlobUrl]);

  const [artistSearch, setArtistSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');

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

  useEffect(() => {
    if (isMobile) return;
    setShowQuickCapture(false);
    setQuickCaptureAwaitUserTap(false);
    setReRecordPrimedStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setReRecordGesturePending(false);
  }, [isMobile]);

  // Sync hydrate from upload-outbox memory cache before first paint (iOS router state often drops Blobs).
  useLayoutEffect(() => {
    const handoff = readCaptureHandoffMeta();
    if (hasPendingCaptureReviewHandoff(handoff?.recordingStartedAt)) {
      skipNavVideoHydrationRef.current = false;
    }
    if (skipNavVideoHydrationRef.current || shouldSkipCaptureReviewHydration()) return;
    if (!shouldHydrateCaptureReview(handoff?.recordingStartedAt)) return;
    if (!wantsCaptureReviewScreen(location.search) && !hasPrimedPendingCapture()) return;

    const pending = peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID);
    if (!pending?.video?.size) return;
    if (isCaptureBlobConsumed(pending.video)) return;

    const routerState = location.state as { nativeVideoPath?: string; recordingStartedAt?: string } | null;
    const navAt =
      routerState?.recordingStartedAt ?? handoff?.recordingStartedAt ?? null;
    lastCaptionFromNavAtRef.current = navAt;

    nativeVideoUriRef.current =
      routerState?.nativeVideoPath ?? handoff?.nativeVideoPath ?? null;
    setFormData((prev) => ({ ...prev, video_blob: pending.video }));
    setUploadMethod('file');
    setUploadSource('capture');
    assignCapturePreviewVideo(
      pending.video,
      routerState?.nativeVideoPath ?? handoff?.nativeVideoPath ?? null,
    );
    setShowCaptionScreen(true);
    setShowQuickCapture(false);
    clearPendingCaptureReviewHandoff(navAt);
  }, [location.search, location.state, assignCapturePreviewVideo]);

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
    if (!isMobile) {
      setShowQuickCapture(false);
      setQuickCaptureAwaitUserTap(false);
      navigate({ pathname: '/upload', search: '' }, { replace: true });
      return;
    }
    if (showQuickCapture) {
      setQuickCaptureAwaitUserTap(false);
      return;
    }
    setQuickCaptureAwaitUserTap(true);
  }, [location.search, showCaptionScreen, user, isPending, isMobile, navigate, showQuickCapture]);

  // Check if we received a recorded video blob from QuickRecord
  useEffect(() => {
    let cancelled = false;

    const handoff = readCaptureHandoffMeta();
    if (hasPendingCaptureReviewHandoff(handoff?.recordingStartedAt)) {
      skipNavVideoHydrationRef.current = false;
    }
    if (skipNavVideoHydrationRef.current || shouldSkipCaptureReviewHydration()) return;
    if (!shouldHydrateCaptureReview(handoff?.recordingStartedAt)) return;

    const routerState = location.state as {
      videoBlob?: Blob;
      videoFile?: File;
      recordingStartedAt?: string;
      nativeVideoPath?: string;
      fromPhotoLibrary?: boolean;
      fromQuickCapture?: boolean;
      showData?: Record<string, unknown>;
      captureGeo?: {
        latitude?: number;
        longitude?: number;
        city?: string | null;
        state?: string | null;
        country?: string | null;
      };
      videoMetadata?: {
        recording_orientation?: 'portrait' | 'landscape';
        video_resolution_w?: number;
        video_resolution_h?: number;
      };
      auddPrefill?: AudDNavPrefill;
    } | null;

    const navState = {
      ...handoff,
      ...routerState,
      recordingStartedAt: routerState?.recordingStartedAt ?? handoff?.recordingStartedAt,
      nativeVideoPath: routerState?.nativeVideoPath ?? handoff?.nativeVideoPath,
      captureGeo: routerState?.captureGeo ?? handoff?.captureGeo ?? undefined,
      videoMetadata: routerState?.videoMetadata ?? handoff?.videoMetadata,
      auddPrefill: routerState?.auddPrefill ?? handoff?.auddPrefill ?? undefined,
      showData: routerState?.showData ?? handoff?.showData,
    };

    const navAt =
      typeof navState.recordingStartedAt === 'string' ? navState.recordingStartedAt : null;

    const hydrateCapturedBlob = (blob: Blob, nativePath?: string | null) => {
      if (
        skipNavVideoHydrationRef.current &&
        !hasPendingCaptureReviewHandoff(navAt)
      ) {
        return;
      }
      skipNavVideoHydrationRef.current = false;
      if (
        wasCaptureRecentlyShared() ||
        wasBlobRecentlyShared(blob) ||
        isCaptureBlobConsumed(blob) ||
        wasRecordingStartedAtShared(navAt)
      ) {
        return;
      }
      lastCaptionFromNavAtRef.current = navAt;

      nativeVideoUriRef.current = nativePath ?? null;
      setFormData((prev) => ({ ...prev, video_blob: blob }));
      setUploadMethod('file');
      setUploadSource('capture');

      assignCapturePreviewVideo(blob, nativePath ?? null);
      setShowCaptionScreen(true);
      setShowQuickCapture(false);
      clearPendingCaptureReviewHandoff(navAt);
      setReRecordPrimedStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      setReRecordGesturePending(false);
    };

    const shouldTryHydrate =
      wantsCaptureReviewScreen(location.search) ||
      Boolean(navState.videoBlob?.size) ||
      navState.recordingStartedAt ||
      navState.fromQuickCapture ||
      hasPrimedPendingCapture();

    if (shouldTryHydrate && !navState.videoFile) {
      void (async () => {
        let blob = navState.videoBlob?.size ? navState.videoBlob : null;
        if (!blob) {
          blob = await resolvePendingCaptureForReview({
            nativeVideoPath: navState.nativeVideoPath ?? null,
          });
        }
        if (cancelled || !blob?.size) return;
        hydrateCapturedBlob(blob, navState.nativeVideoPath ?? null);
      })();
    } else if (navState.videoBlob?.size) {
      hydrateCapturedBlob(navState.videoBlob, navState.nativeVideoPath ?? null);
    }

    if (navState.videoFile) {
      const fileAt = navAt ?? `file:${(location.state.videoFile as File).lastModified}`;
      if (skipNavVideoHydrationRef.current || wasCaptureRecentlyShared()) {
        return;
      }
      lastCaptionFromNavAtRef.current = fileAt;

      const selectedFile = navState.videoFile;
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
    const navFromLibrary = Boolean(navState?.fromPhotoLibrary);
    const navQuickCapture = Boolean(
      navState?.videoBlob || navState?.recordingStartedAt || navState?.fromQuickCapture,
    );
    let showData = navState?.showData;
    if (!showData && !navFromLibrary && navQuickCapture) {
      const capGeo = navState?.captureGeo;
      if (showMarksHydrated) {
        const autoFill = resolveCameraGoingAutoFill(
          captureMarks,
          Date.now(),
          capGeo?.latitude,
          capGeo?.longitude,
        );
        if (autoFill) {
          showData = clipShowCandidateToNavState(autoFill.candidate);
        }
      }
      if (!showData) {
        const sticky = loadCaptureShowSession({
          lat: capGeo?.latitude,
          lon: capGeo?.longitude,
          uploadsInFlight: clipUploadsInFlight > 0,
        });
        if (showMarksHydrated && sticky?.source === 'going') {
          clearCaptureShowSession();
        } else if (sticky && sticky.source !== 'going') {
          showData = clipShowCandidateToNavState(sticky.candidate);
        }
      }
    }

    if (showData && !navFromLibrary) {
      const cap = navState?.captureGeo;
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

    const nav = navState;
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
    
    if (navState.videoMetadata) {
      const metadata = navState.videoMetadata;
      setVideoMetadata({
        recording_orientation: metadata.recording_orientation,
        video_resolution_w: metadata.video_resolution_w,
        video_resolution_h: metadata.video_resolution_h,
      });
    }

    const ap = navState.auddPrefill;
    if (ap?.sourceKey && !navFromLibrary) {
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

    // Cancel in-flight async hydration when navigation changes
    return () => {
      cancelled = true;
    };
  }, [location.state, location.search]);

  useEffect(() => {
    if (!wantsCaptureReviewScreen(location.search)) return;
    if (skipNavVideoHydrationRef.current || shouldSkipCaptureReviewHydration()) return;
    setShowQuickCapture(false);
    setQuickCaptureAwaitUserTap(false);
  }, [location.search]);

  useEffect(() => {
    const onPendingReady = () => {
      const handoff = readCaptureHandoffMeta();
      if (hasPendingCaptureReviewHandoff(handoff?.recordingStartedAt)) {
        skipNavVideoHydrationRef.current = false;
      }
      if (skipNavVideoHydrationRef.current || shouldSkipCaptureReviewHydration()) return;
      if (!shouldHydrateCaptureReview(handoff?.recordingStartedAt)) return;
      void (async () => {
        const blob = await resolvePendingCaptureForReview({
          nativeVideoPath: handoff?.nativeVideoPath ?? null,
        });
        if (!blob?.size) return;
        if (wasBlobRecentlyShared(blob)) return;
        if (
          skipNavVideoHydrationRef.current &&
          !hasPendingCaptureReviewHandoff(handoff?.recordingStartedAt)
        ) {
          return;
        }
        skipNavVideoHydrationRef.current = false;
        const navAt = handoff?.recordingStartedAt ?? null;
        if (navAt && navAt === lastCaptionFromNavAtRef.current) return;
        if (wasRecordingStartedAtShared(navAt)) return;

        lastCaptionFromNavAtRef.current = navAt;

        nativeVideoUriRef.current = handoff?.nativeVideoPath ?? null;
        setFormData((prev) => ({ ...prev, video_blob: blob }));
        setUploadMethod('file');
        setUploadSource('capture');
        assignCapturePreviewVideo(blob, handoff?.nativeVideoPath ?? null);
        setShowCaptionScreen(true);
        setShowQuickCapture(false);
        clearPendingCaptureReviewHandoff(navAt);
      })();
    };
    window.addEventListener(PENDING_CAPTURE_READY_EVENT, onPendingReady);
    return () => window.removeEventListener(PENDING_CAPTURE_READY_EVENT, onPendingReady);
  }, []);
  
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');

  /** Ensure clip is in IndexedDB when caption screen opens (Photos save runs once in capture handoff). */
  useEffect(() => {
    if (!showCaptionScreen || uploadMethod !== 'file') return;
    if (uploadSource === 'capture') return;
    const source = formData.video_blob ?? formData.video_file;
    if (!source) return;
    const key = blobSourceKey(source);
    if (galleryCaptureKeyRef.current === key) return;
    galleryCaptureKeyRef.current = key;
    const ext = source.type.includes('mp4') ? 'mp4' : 'webm';
    const fileName =
      formData.video_file?.name ?? `momentum-${Date.now()}.${ext}`;
    void persistClipLocallyOnCapture(source, fileName);
  }, [
    showCaptionScreen,
    uploadMethod,
    uploadSource,
    formData.video_blob,
    formData.video_file,
  ]);

  /** Restore pre-Share clip + caption draft after a full page refresh (no router state). */
  useEffect(() => {
    if (!user || isPending) return;
    if (location.pathname !== '/upload') return;
    if (!wantsCaptureReviewScreen(location.search) && !hasPrimedPendingCapture()) return;
    if (skipNavVideoHydrationRef.current || shouldSkipCaptureReviewHydration()) return;
    if (!shouldHydrateCaptureReview()) return;
    const nav = location.state as {
      videoBlob?: unknown;
      videoFile?: unknown;
      recordingStartedAt?: unknown;
      fromQuickCapture?: unknown;
    } | null | undefined;
    if (nav?.videoBlob || nav?.videoFile || nav?.recordingStartedAt || nav?.fromQuickCapture) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const pending = await loadPendingCapture();
      if (cancelled || !pending?.video) return;
      if (wasBlobRecentlyShared(pending.video) || isCaptureBlobConsumed(pending.video)) return;

      const sourceKey = blobSourceKey(pending.video);
      const draft = await loadCaptionDraft();
      const matchingDraft = captionDraftMatchesVideo(draft, sourceKey) ? draft : null;

      if (cancelled) return;

      galleryCaptureKeyRef.current = sourceKey;
      setUploadMethod(matchingDraft?.uploadMethod ?? 'file');
      setUploadSource(matchingDraft?.uploadSource ?? 'capture');
      setFormData((prev) => ({
        ...prev,
        video_blob: pending.video,
        video_file: null,
        thumbnail_file: pending.thumbnail
          ? new File([pending.thumbnail], 'thumb.jpg', { type: 'image/jpeg' })
          : null,
        video_url: matchingDraft?.form.video_url ?? '',
        thumbnail_url: matchingDraft?.form.thumbnail_url ?? '',
        artist_name: matchingDraft?.form.artist_name ?? '',
        venue_name: matchingDraft?.form.venue_name ?? '',
        location: matchingDraft?.form.location ?? '',
        content_description: matchingDraft?.form.content_description ?? '',
        song_title: matchingDraft?.form.song_title ?? '',
        genre_name: matchingDraft?.form.genre_name ?? '',
        hashtags: matchingDraft?.form.hashtags ?? '',
      }));
      setJambaseLink(
        matchingDraft?.jambaseLink
          ? {
              event: matchingDraft.jambaseLink.event,
              artist: matchingDraft.jambaseLink.artist,
              venue: matchingDraft.jambaseLink.venue,
              eventTitle: matchingDraft.jambaseLink.eventTitle ?? null,
            }
          : null,
      );
      setRecordingAtIso(matchingDraft?.recordingAtIso ?? null);
      setCaptureGeo(matchingDraft?.captureGeo ?? null);
      setVideoMetadata(matchingDraft?.videoMetadata ?? {});
      setArtistSearch(matchingDraft?.artistSearch ?? '');
      setVenueSearch(matchingDraft?.venueSearch ?? '');
      setStoredClassificationId(matchingDraft?.storedClassificationId ?? null);
      setClassifyResult(matchingDraft?.classifyResult ?? null);
      if (matchingDraft?.classifyResult || matchingDraft?.storedClassificationId) {
        setClassifyStatus('done');
      }

      if (matchingDraft?.captureGeo) {
        const sticky = loadStickyCaptureShowSession({
          lat: matchingDraft.captureGeo.latitude,
          lon: matchingDraft.captureGeo.longitude,
          uploadsInFlight: clipUploadsInFlight > 0,
        });
        if (sticky && !matchingDraft.jambaseLink) {
          const showData = clipShowCandidateToNavState(sticky.candidate);
          setFormData((prev) => ({
            ...prev,
            artist_name: prev.artist_name?.trim()
              ? prev.artist_name
              : (showData.artist_name as string) || '',
            venue_name: prev.venue_name?.trim()
              ? prev.venue_name
              : (showData.venue_name as string) || '',
            location: prev.location?.trim() ? prev.location : (showData.location as string) || '',
          }));
        }
      }

      const handoffNative = readCaptureHandoffMeta()?.nativeVideoPath ?? null;
      assignCapturePreviewVideo(pending.video, handoffNative);
      setShowCaptionScreen(true);
      setShowQuickCapture(false);
      setResolveNotice(
        'We restored your clip from this device. Finish tagging and tap Share when you are ready.',
      );
    })();

    return () => {
      cancelled = true;
    };
    // Do not depend on clipUploadJobs — when the last published job is removed (~8s after
    // upload) this must NOT re-run and resurrect Share your moment from stale IDB data.
  }, [user, isPending, location.pathname, location.search, location.state]);

  // Artist autocomplete
  const [artistSuggestions, setArtistSuggestions] = useState<JamBaseArtist[]>([]);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [artistSearchPending, setArtistSearchPending] = useState(false);
  const debouncedArtistSearch = useDebounce(artistSearch, 300);
  
  // Venue autocomplete
  const [venueSuggestions, setVenueSuggestions] = useState<JamBaseVenue[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);
  const [venueSearchPending, setVenueSearchPending] = useState(false);
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  /** Persist caption progress while the user is still on the post-capture screen. */
  useEffect(() => {
    if (!showCaptionScreen) return;
    const source = formData.video_blob ?? formData.video_file;
    if (!source) return;

    const timer = window.setTimeout(() => {
      void saveCaptionDraft({
        savedAtMs: Date.now(),
        blobSourceKey: blobSourceKey(source),
        uploadMethod,
        uploadSource,
        form: {
          video_url: formData.video_url,
          thumbnail_url: formData.thumbnail_url,
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
        artistSearch,
        venueSearch,
        storedClassificationId,
        classifyResult,
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    showCaptionScreen,
    uploadMethod,
    uploadSource,
    formData,
    jambaseLink,
    recordingAtIso,
    captureGeo,
    videoMetadata,
    artistSearch,
    venueSearch,
    storedClassificationId,
    classifyResult,
  ]);

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
    setShowResolveLoading(false);

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
          void fetch(
            `/api/maps/reverse-geocode?lat=${meta.latitude}&lng=${meta.longitude}`,
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { results?: { address_components?: { long_name: string; short_name: string; types: string[] }[] }[] } | null) => {
              if (cancelled || !data?.results?.[0]?.address_components) return;
              const parts = data.results[0].address_components;
              const city =
                parts.find((p) => p.types.includes('locality'))?.long_name ??
                parts.find((p) => p.types.includes('postal_town'))?.long_name ??
                null;
              const state =
                parts.find((p) => p.types.includes('administrative_area_level_1'))?.short_name ??
                null;
              const country =
                parts.find((p) => p.types.includes('country'))?.short_name ?? null;
              if (!city && !state) return;
              setCaptureGeo((prev) =>
                prev
                  ? {
                      ...prev,
                      city: city ?? prev.city,
                      state: state ?? prev.state,
                      country: country ?? prev.country,
                    }
                  : prev,
              );
            })
            .catch(() => undefined);
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
    const geo = captureGeo;
    if (
      geo &&
      Number.isFinite(geo.latitude) &&
      Number.isFinite(geo.longitude)
    ) {
      saveCaptureShowSession(c, geo.latitude, geo.longitude, { source: 'resolve' });
    }
  }, [captureGeo]);

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
      fromQuickCapture?: boolean;
      recordingStartedAt?: string;
      captureGeo?: {
        latitude: number;
        longitude: number;
        city: string | null;
        state: string | null;
        country: string | null;
      };
    } | null;

    const handoff = readCaptureHandoffMeta();
    const fromQuick = isQuickCaptureReviewFlow(location.search, nav, handoff);
    const isQuickCaption =
      showCaptionScreen &&
      (fromQuick || Boolean(formData.video_blob) || uploadSource === 'capture');

    const resolveForFile =
      Boolean(formData.video_file && uploadMethod === 'file' && !fromQuick);

    const preloadedShow = nav?.showData ?? handoff?.showData;
    /** Auto-tag from GPS when QuickRecord / session did not preload show data */
    const resolveForAutoTagQuick =
      isQuickCaption &&
      !preloadedShow &&
      !jambaseLink?.venue &&
      !jambaseLink?.event;

    if (!resolveForFile && !resolveForAutoTagQuick) return;

    if (uploadSource === 'library') {
      if (!libraryMetaReady) return;
      if (autoShowTagAppliedRef.current || userOverrodeAutoTagsRef.current) return;
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
    setShowResolveLoading(true);
    (async () => {
      try {
        let geo = captureGeo;
      if (uploadSource === 'library') {
        const captureMs = Number.isFinite(Date.parse(at)) ? Date.parse(at) : Date.now();
        if (
          showMarksHydrated &&
          (!geo || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude))
        ) {
          const markMatch = pickShowMarkForLibraryUpload(captureMarks, captureMs);
          if (markMatch && !cancelled) {
            applyClipCandidate(showMarkToClipCandidate(markMatch));
            setResolveNotice(null);
            return;
          }
        }
        if (
          !geo ||
          !Number.isFinite(geo.latitude) ||
          !Number.isFinite(geo.longitude)
        ) {
          if (!cancelled) {
            if (libraryFileMeta?.recordedAtIso) {
              beginEditingTags();
              setResolveNotice(
                'Found when this was recorded, but no GPS in the video file — search for your venue below.',
              );
            } else {
              beginEditingTags();
              setResolveNotice(
                'No date or location in this video file — add artist, venue, and song below.',
              );
            }
          }
          return;
        }
      } else if (
        (geo == null || !Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) &&
        (nav?.captureGeo != null || handoff?.captureGeo != null)
      ) {
        const capGeo = nav?.captureGeo ?? handoff?.captureGeo;
        if (
          capGeo &&
          Number.isFinite(capGeo.latitude) &&
          Number.isFinite(capGeo.longitude)
        ) {
          geo = capGeo;
          if (!cancelled) setCaptureGeo(geo);
        }
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
            if (!cancelled && showMarksHydrated) {
              const captureMs = Number.isFinite(Date.parse(at)) ? Date.parse(at) : Date.now();
              const autoFill = resolveCameraGoingAutoFill(captureMarks, captureMs);
              if (autoFill) {
                applyClipCandidate(autoFill.candidate);
                setResolveNotice(null);
                return;
              }
            }
            const stickyOffline = loadStickyCaptureShowSession({
              uploadsInFlight: clipUploadsInFlight > 0,
            });
            if (!cancelled && stickyOffline) {
              applyClipCandidate(stickyOffline.candidate);
              setResolveNotice(null);
              return;
            }
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

      const stickySession = loadStickyCaptureShowSession({
        lat: geo.latitude,
        lon: geo.longitude,
        uploadsInFlight: clipUploadsInFlight > 0,
      });

      if (showMarksHydrated && resolveForAutoTagQuick) {
        const atMs = Date.parse(at);
        const autoFill = resolveCameraGoingAutoFill(
          captureMarks,
          Number.isFinite(atMs) ? atMs : Date.now(),
          geo.latitude,
          geo.longitude,
        );
        if (autoFill) {
          applyClipCandidate(autoFill.candidate);
          saveCaptureShowSession(autoFill.candidate, geo.latitude, geo.longitude, {
            source: 'going',
          });
          return;
        }

        if (stickySession?.source === 'going') {
          clearCaptureShowSession();
        }
      }

      if (
        stickySession &&
        stickySession.source !== 'going' &&
        (stickySession.candidate.venue_name?.trim() ||
          stickySession.candidate.jambase_venue_id?.trim()) &&
        resolveForAutoTagQuick
      ) {
        applyClipCandidate(stickySession.candidate);
        return;
      }

      try {
        const res = await fetch('/api/clips/resolve-show', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            latitude: geo.latitude,
            longitude: geo.longitude,
            at,
            libraryUpload: uploadSource === 'library',
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

        const pickerVenues = (data.nearbyVenues ?? []).slice(0, 5);
        setNearbyVenueChoices(pickerVenues);

        const captureMs = Number.isFinite(Date.parse(at)) ? Date.parse(at) : Date.now();
        const goingOverride = resolveShowAutoApplyCandidate(
          data,
          captureMarks,
          captureMs,
          geo.latitude,
          geo.longitude,
        );

        const applyClosest = () => {
          const autoApply = goingOverride ?? (data.match === 'single' ? data.candidates?.[0] : null);
          if (autoApply) {
            applyClipCandidate(autoApply);
            saveCaptureShowSession(autoApply, geo.latitude, geo.longitude, { source: 'resolve' });
            setResolveNotice(null);
          } else if (data.match === 'ambiguous' && pickerVenues.length > 0) {
            setResolveNotice(
              data.notice ??
                'Several venues are nearby — pick the one you are at.',
            );
          } else if (data.match === 'none') {
            setResolveNotice(
              pickerVenues.length > 0
                ? (data.notice ?? 'Pick the venue you are at from tonight\u2019s shows nearby.')
                : (data.notice ??
                    'No nearby JamBase venue matched your location. You can enter venue and artist manually.'),
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
        const stickyFallback = loadStickyCaptureShowSession({
          lat: geo.latitude,
          lon: geo.longitude,
          uploadsInFlight: clipUploadsInFlight > 0,
        });
        if (stickyFallback && resolveForAutoTagQuick) {
          applyClipCandidate(stickyFallback.candidate);
          setResolveNotice(null);
          return;
        }
        setResolveNotice('Auto-tagging is temporarily unavailable. You can still enter details manually.');
      }
      } finally {
        if (!cancelled) setShowResolveLoading(false);
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
    formData.video_blob,
    uploadMethod,
    showCaptionScreen,
    recordingAtIso,
    captureGeo,
    location.state,
    location.search,
    lastKnownGeo,
    applyClipCandidate,
    getDeviceCoordinates,
    ingestCaptureGeo,
    uploadSource,
    libraryMetaReady,
    libraryFileMeta,
    clipUploadsInFlight,
    showMarksHydrated,
    captureMarks,
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

  /** Probe Worker ACR config once on caption screen — surfaces missing keys before song ID runs. */
  useEffect(() => {
    if (!showCaptionScreen || !user || isPending) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/clips/identify-music/config', { credentials: 'include' });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          activeProvider?: string;
          acrcloud?: { ready?: boolean };
          hint?: string | null;
          verify?: string;
        };
        if (cancelled) return;
        if (data.acrcloud?.ready) return;
        const hint =
          (typeof data.hint === 'string' && data.hint.trim()) ||
          (typeof data.verify === 'string' && data.verify.trim()) ||
          'Song ID (ACRCloud) is not configured on the worker.';
        setAuddStatus((prev) =>
          prev === 'done' || prev === 'loading' ? prev : 'error',
        );
        setAuddMessage((prev) => (prev?.trim() ? prev : hint));
      } catch {
        /* offline / proxy — identify pass will report errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showCaptionScreen, user, isPending]);

  useEffect(() => {
    if (!showCaptionScreen || recordingAtIso) return;
    setRecordingAtIso(new Date().toISOString());
  }, [showCaptionScreen, recordingAtIso]);

  /**
   * Classify feed lane when the caption screen opens (background only — never blocks venue/artist UI).
   */
  useEffect(() => {
    if (!showCaptionScreen || !user || isPending) return;
    if (BYPASS_CONTENT_FEED_BIFURCATION || clipManualShowPostReady(formData)) {
      setClassifyStatus('done');
      setClassifyMessage(null);
      return;
    }
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

      if (out.content_feed === 'pre_post' && !BYPASS_CONTENT_FEED_BIFURCATION) {
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
    formData.venue_name,
    location.state,
    clearShowAssociationFields,
  ]);

  /** After 5s with no song match, show manual song entry while identify may still finish. */
  useEffect(() => {
    if (!showCaptionScreen || auddStatus !== 'loading') return;
    const t = window.setTimeout(() => {
      setAuddStatus((s) => (s === 'loading' ? 'nomatch' : s));
    }, 5000);
    return () => clearTimeout(t);
  }, [showCaptionScreen, auddStatus]);

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
    });

    const feedChanged = derived.content_feed !== classifyResult.content_feed;
    const headlinerChanged =
      derived.headliner_matched !== classifyResult.headliner_matched;
    if (!feedChanged && !headlinerChanged) return;

    setClassifyResult(derived);
    setStoredClassificationId(null);
    const ui = contentFeedUserMessage(derived);
    setClassifyMessage(ui?.message ?? null);
    setClassifyStatus('done');
  }, [
    classifyStatus,
    classifyResult?.acr_matched,
    classifyResult?.acr_artist,
    classifyResult?.acr_title,
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

    const nav = location.state as {
      captureAudioBlob?: unknown;
      auddPrefill?: AudDNavPrefill;
    } | null;
    const captureAudio =
      nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null;
    const ap = nav?.auddPrefill;

    /** Live capture already stabilized a match — skip the slow full re-identify pass. */
    if (
      ap?.sourceKey === sourceKey &&
      ap.status === 'done' &&
      (ap.artist?.trim() || ap.title?.trim())
    ) {
      auddAttemptedForSourceKeyRef.current = sourceKey;
      return;
    }

    auddAttemptedForSourceKeyRef.current = sourceKey;
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

      const hadLivePrefill = Boolean(
        liveHint?.title?.trim() ||
          liveHint?.artist?.trim() ||
          (ap?.status === 'done' && (ap.artist?.trim() || ap.title?.trim())),
      );

      if (result.status === 'skipped' && result.message?.trim()) {
        setAuddStatus('error');
        setAuddMessage(result.message);
        return;
      }
      if (result.status === 'nomatch') {
        if (!hadLivePrefill) {
          setAuddStatus('nomatch');
          setAuddMessage(null);
        }
        return;
      }
      if (result.status === 'error') {
        setAuddStatus('error');
        setAuddMessage(result.message ?? 'Song lookup failed');
        return;
      }
      if (result.status !== 'match') return;

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
    setShowResolveLoading(false);
    setAuddStatus('idle');
    setAuddMessage(null);
    userOverrodeAutoTagsRef.current = false;
    autoShowTagAppliedRef.current = false;
    auddAttemptedForSourceKeyRef.current = null;
    captionCommittedArtistNameRef.current = '';
    captionCommittedVenueNameRef.current = '';
    setArtistSearch('');
    setVenueSearch('');
    if (videoBlobUrl) revokeCapturePreviewVideo(videoBlobUrl);
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

  const handleEventTitleChange = useCallback(
    (value: string) => {
      markTagsEdited();
      setJambaseLink((prev) => ({
        event: prev?.event ?? null,
        artist: prev?.artist ?? null,
        venue: prev?.venue ?? null,
        eventTitle: value.trim() || null,
      }));
    },
    [markTagsEdited],
  );

  const handleCaptureDateChange = useCallback((value: string) => {
    markTagsEdited();
    setRecordingAtIso(dateInputValueToIso(value));
  }, [markTagsEdited]);

  const buildUploadPayload = useCallback(
    (
      classificationId: string,
      contentFeed: 'main' | 'pre_post',
      formOverride?: typeof formData,
      jambaseOverride?: typeof jambaseLink,
    ): ClipUploadJobPayload => {
    const nav = location.state as { captureAudioBlob?: unknown } | null;
    const form = formOverride ?? formData;
    const link = jambaseOverride ?? jambaseLink;
    return {
      uploadMethod,
      videoFile: form.video_file,
      videoBlob: form.video_blob,
      thumbnailFile: form.thumbnail_file,
      videoUrl: form.video_url,
      classificationId,
      contentFeed,
      captureAudioBlob:
        nav?.captureAudioBlob instanceof Blob ? nav.captureAudioBlob : null,
      form: {
        artist_name: form.artist_name,
        venue_name: form.venue_name,
        location: form.location,
        content_description: form.content_description,
        song_title: form.song_title,
        genre_name: form.genre_name,
        hashtags: form.hashtags,
      },
      jambaseLink: link,
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

  const resetForNextCapture = useCallback((opts?: { discarded?: boolean; shared?: boolean }) => {
    if (videoBlobUrl) {
      revokeCapturePreviewVideo(videoBlobUrl);
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
    void clearLocalCaptureDraft({ ...opts, video: formData.video_blob });
  }, [clearLocalCaptureDraft, formData.video_blob, videoBlobUrl]);

  /** Re-open in-app capture after Share so the user can record the next clip while uploads run. */
  const reopenCaptureAfterQueuedShare = useCallback(() => {
    skipNavVideoHydrationRef.current = true;
    lastCaptionFromNavAtRef.current = null;
    leaveReviewCaptureRouteAfterShare();
  }, [leaveReviewCaptureRouteAfterShare]);

  /** Return home after discard — user re-opens capture via the Capture button. */
  const resumeGlobalCaptureAfterReview = useCallback(() => {
    setShowQuickCapture(false);
    setQuickCaptureAwaitUserTap(false);
    navigate({ pathname: '/', search: '' }, { replace: true, state: null });
  }, [navigate]);

  const applyPostShareSideEffects = useCallback(
    (
      manual: boolean,
      classificationPending: boolean,
      contentFeed: 'main' | 'pre_post',
      snapshot?: {
        artist_name: string;
        venue_name: string;
        location: string;
        jambaseLink: typeof jambaseLink;
      },
    ) => {
      const artistName = snapshot?.artist_name ?? formData.artist_name;
      const venueName = snapshot?.venue_name ?? formData.venue_name;
      const locationLine = snapshot?.location ?? formData.location;
      const link = snapshot?.jambaseLink ?? jambaseLink;

      if (
        !venueName?.trim() ||
        (!manual && classificationPending) ||
        (!manual && contentFeed !== 'main')
      ) {
        return;
      }
      const posted = captureShowCandidateFromPostedClip({
        artist_name: artistName,
        venue_name: venueName,
        location: locationLine,
        jambaseLink: link,
      });
      if (
        posted &&
        captureGeo &&
        Number.isFinite(captureGeo.latitude) &&
        Number.isFinite(captureGeo.longitude)
      ) {
        markCaptureShowSessionPosted(posted, captureGeo.latitude, captureGeo.longitude);
      }
      if (link?.event?.trim()) {
        const markInput = jamBaseEventToShowMarkInput(
          {
            identifier: link.event,
            name: link.eventTitle ?? venueName,
            startDate: recordingAtIso ?? new Date().toISOString(),
            performer: artistName
              ? [{ name: artistName, identifier: link.artist, 'x-isHeadliner': true }]
              : [],
            location: {
              name: venueName,
              identifier: link.venue,
              address: { addressLocality: locationLine?.split(',')[0]?.trim() },
            },
          },
          'attended',
        );
        if (markInput) {
          void fetch('/api/users/me/show-marks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(markInput),
          }).then(() => {
            window.dispatchEvent(new CustomEvent('show-marks-changed'));
          });
        }
      }
    },
    [
      formData.artist_name,
      formData.venue_name,
      formData.location,
      jambaseLink,
      captureGeo,
      recordingAtIso,
    ],
  );

  const finishAfterQueuedShare = useCallback((opts?: { fromCaption?: boolean }) => {
    blockCaptureReviewRecovery();
    skipNavVideoHydrationRef.current = true;
    lastCaptionFromNavAtRef.current = null;
    setShowCaptionScreen(false);
    resetForNextCapture({ shared: true });
    const leaveCaption = opts?.fromCaption ?? showCaptionScreen;
    if (leaveCaption && isMobile) {
      reopenCaptureAfterQueuedShare();
    } else if (leaveCaption) {
      resumeGlobalCaptureAfterReview();
    } else {
      setShowQuickCapture(false);
      navigate({ pathname: '/', search: '' }, { replace: true, state: null });
    }
  }, [
    isMobile,
    navigate,
    reopenCaptureAfterQueuedShare,
    resetForNextCapture,
    resumeGlobalCaptureAfterReview,
    showCaptionScreen,
  ]);

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();

    if (uploadMethod === 'file' && !formData.video_file && !formData.video_blob) {
      const nativePath =
        nativeVideoUriRef.current ?? readCaptureHandoffMeta()?.nativeVideoPath ?? null;
      if (!(uploadSource === 'capture' && nativePath?.trim())) {
        setError('Please select a video file');
        return;
      }
    }

    if (uploadMethod === 'url' && !formData.video_url) {
      setError('Video URL is required');
      return;
    }

    const stickyPatch = stickyUploadFormPatch(
      formData,
      jambaseLink,
      {
        lat: captureGeo?.latitude,
        lon: captureGeo?.longitude,
        uploadsInFlight: true,
      },
    );
    const shareForm = stickyPatch
      ? {
          ...formData,
          artist_name: stickyPatch.artist_name,
          venue_name: stickyPatch.venue_name,
          location: stickyPatch.location || formData.location,
        }
      : formData;
    const shareJambaseLink = stickyPatch?.jambaseLink ?? jambaseLink;

    const classification = resolveEnqueueClassification({
      uploadMethod,
      form: shareForm,
      storedClassificationId,
      classifyResult,
    });
    if (!classification.ok) {
      setError(classification.error);
      return;
    }

    const manualAfterSticky = clipManualShowPostReady(shareForm);
    const queueMainFeedClip = !isPrePostContentFeed(classification.contentFeed);

    let formForUpload = shareForm;
    if (uploadMethod === 'file' && uploadSource === 'capture') {
      const handoffMeta = readCaptureHandoffMeta();
      const nativePath =
        nativeVideoUriRef.current ?? handoffMeta?.nativeVideoPath ?? null;
      const resolvedBlob = await resolveNativeCaptureUploadBlob(
        nativePath,
        shareForm.video_blob,
        {
          requireAudio: true,
          nativeAudioTrackCount: handoffMeta?.nativeAudioTrackCount,
        },
      );
      if (!resolvedBlob?.size) {
        setError('Could not read this clip. Try recording again.');
        return;
      }
      try {
        await assertCaptureBlobHasAudio(resolvedBlob, {
          nativeAudioTrackCount: handoffMeta?.nativeAudioTrackCount,
          webStreamHadAudio: !shouldUseNativeIosCapture(),
        });
      } catch {
        setError('This clip has no audio. Try recording again.');
        return;
      }
      formForUpload = { ...shareForm, video_blob: resolvedBlob };
    }

    // Block caption recovery before enqueue — queue updates re-run hydration effects.
    const sharedRecordingAt =
      lastCaptionFromNavAtRef.current ??
      readCaptureHandoffMeta()?.recordingStartedAt ??
      recordingAtIso;
    blockCaptureReviewRecovery();
    if (sharedRecordingAt) {
      markRecordingStartedAtShared(sharedRecordingAt);
    }
    skipNavVideoHydrationRef.current = true;
    setShowCaptionScreen(false);
    invalidatePendingCaptureFlush();
    clearPendingCaptureMemory({ force: true });
    if (formForUpload.video_blob?.size) {
      markCaptureSharedForBlob(formForUpload.video_blob, nativeVideoUriRef.current);
    }

    const jobId = enqueueClipUpload(
      {
        ...buildUploadPayload(
          classification.classificationId,
          classification.contentFeed,
          formForUpload,
          shareJambaseLink,
        ),
        classificationPending: classification.classificationPending,
        songIdentifyPending:
          uploadMethod === 'file' &&
          queueMainFeedClip &&
          !shareForm.song_title?.trim(),
      },
      uploadMethod === 'file' ? videoBlobUrl : null,
    );
    if (!jobId) {
      setError(
        formData.video_blob || formData.video_file
          ? 'Could not queue this clip. Try recording again.'
          : 'Too many clips are uploading. Wait for one to finish, then try again.',
      );
      return;
    }

    applyPostShareSideEffects(
      manualAfterSticky,
      classification.classificationPending,
      classification.contentFeed,
      stickyPatch
        ? {
            artist_name: shareForm.artist_name,
            venue_name: shareForm.venue_name,
            location: shareForm.location,
            jambaseLink: shareJambaseLink,
          }
        : undefined,
    );
    setError(null);
    blockCaptureReviewRecovery();
    await clearPendingCapture();
    await clearCaptionDraft();
    finishAfterQueuedShare({ fromCaption: true });
  };

  const handleDiscardCapture = useCallback(() => {
    skipNavVideoHydrationRef.current = true;
    lastCaptionFromNavAtRef.current = null;
    resetForNextCapture({ discarded: true });
    if (isMobile) {
      resumeGlobalCaptureAfterReview();
      return;
    }
    navigate('/', { replace: true });
  }, [isMobile, navigate, resetForNextCapture, resumeGlobalCaptureAfterReview]);

  /** Leave upload (e.g. mobile caption screen) and return to the feed; drops in-progress media. */
  const handleCloseUploadToFeed = () => {
    if (showCaptionScreen && uploadSource === 'capture') {
      handleDiscardCapture();
      return;
    }

    if (videoBlobUrl) {
      revokeCapturePreviewVideo(videoBlobUrl);
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
    void clearLocalCaptureDraft({ discarded: true });
    navigate('/', { replace: true });
  };

  const toggleCaptionVideoPlay = () => {
    const video = captionVideoRef.current;
    if (!video) return;
    if (captionVideoPlaying) {
      video.pause();
      setCaptionVideoPlaying(false);
      return;
    }
    void playVideoWithSoundOnGesture(video, {
      onMutedChange: setCaptionVideoMuted,
      restoreAudioSession: shouldUseNativeIosCapture() ? restoreNativeMediaPlaybackAudio : undefined,
    }).then((ok) => {
      if (ok) setCaptionVideoPlaying(true);
    });
  };

  const toggleCaptionVideoMute = () => {
    const video = captionVideoRef.current;
    if (!video) return;
    const nextMuted = !captionVideoMuted;
    if (nextMuted) {
      setCaptionVideoMuted(true);
      video.muted = true;
      return;
    }
    void playVideoWithSoundOnGesture(video, {
      onMutedChange: setCaptionVideoMuted,
      restoreAudioSession: shouldUseNativeIosCapture() ? restoreNativeMediaPlaybackAudio : undefined,
    }).then((ok) => {
      if (ok) setCaptionVideoPlaying(true);
    });
  };

  const libraryMetaReading =
    uploadSource === 'library' && Boolean(formData.video_file) && !libraryMetaReady;
  const isShowMatching = showResolveLoading || libraryMetaReading;

  useEffect(() => {
    if (!isShowMatching) {
      setShowResolveProgress(0);
      return;
    }

    setShowResolveProgress((prev) => {
      if (libraryMetaReading) return prev < 8 || prev > 40 ? 8 : prev;
      return Math.max(prev, 42);
    });

    const intervalId = window.setInterval(() => {
      setShowResolveProgress((prev) => {
        if (libraryMetaReading) {
          const cap = 38;
          if (prev >= cap) return prev;
          return Math.min(cap, prev + 1.4);
        }
        const cap = 94;
        if (prev >= cap) return prev;
        return Math.min(cap, prev + 0.9);
      });
    }, 70);

    return () => window.clearInterval(intervalId);
  }, [isShowMatching, libraryMetaReading]);

  useEffect(() => {
    if (!showCaptionScreen || uploadSource !== 'capture') {
      setCapturePrepareTimedOut(false);
      return;
    }
    if (formData.video_blob || videoBlobUrl) {
      setCapturePrepareTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setCapturePrepareTimedOut(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [showCaptionScreen, uploadSource, formData.video_blob, videoBlobUrl]);

  // Show native file preview immediately while the upload blob loads in the background.
  useLayoutEffect(() => {
    if (!showCaptionScreen || uploadSource !== 'capture') return;
    if (formData.video_blob || videoBlobUrl) return;
    const handoff = readCaptureHandoffMeta();
    const routerState = location.state as { nativeVideoPath?: string } | null;
    const nativePath =
      nativeVideoUriRef.current ??
      routerState?.nativeVideoPath ??
      handoff?.nativeVideoPath ??
      null;
    const previewUrl = nativeCapturePreviewVideoUrl(nativePath);
    if (!previewUrl) return;
    nativeVideoUriRef.current = nativePath;
    setVideoBlobUrl(previewUrl);
  }, [showCaptionScreen, uploadSource, formData.video_blob, videoBlobUrl, location.state]);

  // Background refresh of the upload blob from the native file (preview stays muted).
  useEffect(() => {
    if (!showCaptionScreen || uploadSource !== 'capture') return;
    const nativePath =
      nativeVideoUriRef.current ?? readCaptureHandoffMeta()?.nativeVideoPath ?? null;
    if (!nativePath || !shouldUseNativeIosCapture()) return;

    let cancelled = false;
    void (async () => {
      const fresh = await resolveNativeCaptureUploadBlob(
        nativePath,
        peekCachedOutboxBlobs(PENDING_CAPTURE_JOB_ID)?.video ?? null,
        { requireAudio: true },
      );
      if (cancelled || !fresh?.size) return;
      setFormData((prev) =>
        prev.video_blob?.size === fresh.size ? prev : { ...prev, video_blob: fresh },
      );
      primePendingCaptureVideo(fresh);
    })();

    return () => {
      cancelled = true;
    };
  }, [showCaptionScreen, uploadSource, videoBlobUrl]);

  // Reset inline preview when opening review or swapping clip source (preview stays muted).
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

  if (quickCaptureAwaitUserTap && wantQuickCaptureUrl && !showCaptionScreen && isMobile) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center">
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

  // Show quick capture modal if requested (mobile only — desktop uses file upload)
  if (showQuickCapture && isMobile && !wantsCaptureReviewScreen(location.search)) {
    return (
      <div
        className={
          shouldUseNativeIosCapture()
            ? 'min-h-screen bg-transparent text-white'
            : 'min-h-screen text-white'
        }
      >
        <QuickRecordButton
          isOpen={true}
          primedMediaStream={reRecordPrimedStream}
          gestureCameraPrimingPending={reRecordGesturePending}
          autoRequestCamera={!reRecordPrimedStream && !reRecordGesturePending}
          captureLaunchGeo={reRecordLaunchGeo}
          captureLaunchGeoResolved={reRecordLaunchGeoResolved}
          deferCameraUntilLaunchGeo={!shouldUseNativeIosCapture()}
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
            setShowCaptionScreen(false);
            blockCaptureReviewRecovery();
            navigate('/', { replace: true });
          }}
        />
      </div>
    );
  }

  // CAPTION SCREEN — post-capture review (same post flow as full "Share your moment" via handleSubmit)
  if (showCaptionScreen) {
    const awaitingCaptureBlob =
      uploadSource === 'capture' &&
      !formData.video_blob &&
      !formData.video_file &&
      !videoBlobUrl;

    if (awaitingCaptureBlob) {
      if (capturePrepareTimedOut) {
        return (
          <div className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center">
            <p className="text-gray-300 text-sm mb-4">We couldn&apos;t load your clip. Try recording again.</p>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-momentum-flare text-white text-sm font-semibold"
              onClick={() => {
                setCapturePrepareTimedOut(false);
                setShowCaptionScreen(false);
                navigate({ pathname: '/upload', search: '?quickCapture=true' }, { replace: true });
              }}
            >
              Record again
            </button>
          </div>
        );
      }
      return (
        <div className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin mb-4" aria-hidden />
          <p className="text-gray-300 text-sm">Preparing your clip…</p>
        </div>
      );
    }

    const isPrePostClip = isPrePostContentFeed(classifyResult?.content_feed);
    const canPostWithShowDetails = clipManualShowPostReady(formData);
    /** Venue/show fields always visible on main-feed clips — filled in parallel with song ID. */
    const showVenueAndShowFields = !isPrePostClip;
    const songIdentifyPending = auddStatus === 'loading';
    const displayEventDate = recordingAtIso
      ? new Date(recordingAtIso).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
    const captionEventTitle = resolveClipEventTitle({
      event_title: jambaseLink?.eventTitle,
      artist_name: formData.artist_name,
      venue_name: formData.venue_name,
    });
    const showMatchFilled = Boolean(
      captionEventTitle?.trim() || formData.venue_name?.trim(),
    );

    return (
      <div className="min-h-screen text-white">
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
                  : songIdentifyPending
                    ? 'Identifying song in the background — you can share now; venue and artist may fill in during upload.'
                    : 'Add details and post. After you share, upload continues in the background so you can record your next clip right away.'}
                {!isPrePostClip && !songIdentifyPending
                  ? uploadSource === 'library'
                    ? ' We read date and location from your video file when available to find a matching show.'
                    : canPostWithShowDetails
                      ? ' Venue and location are filled from GPS and JamBase when we find a match.'
                      : ' Venue and artist can fill in automatically during upload from your location and show data.'
                  : null}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseUploadToFeed}
              className="shrink-0 flex items-center justify-center p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95 transition-transform"
              aria-label="Discard clip and record again"
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
              {showVenueAndShowFields && resolveNotice && !isShowMatching && (
                <div className="p-3 bg-momentum-ember/10 border border-momentum-ember/30 rounded-lg">
                  <p className="text-momentum-glacier/90 text-sm">{resolveNotice}</p>
                </div>
              )}
              {showVenueAndShowFields && nearbyVenueChoices.length > 0 && (
                <div className="rounded-lg border border-white/15 bg-white/[0.06] p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Nearby shows tonight</p>
                  <p className="text-xs text-gray-400">
                    JamBase listings with a show on your capture date — pick the venue you are at.
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
              {showVenueAndShowFields && auddStatus === 'nomatch' && (
                <div className="p-3 bg-momentum-flare/10 border border-momentum-flare/30 rounded-lg">
                  <p className="text-momentum-flare/90 text-sm font-medium">
                    No song match yet — enter the song title below (optional).
                  </p>
                </div>
              )}
              {showVenueAndShowFields && auddStatus === 'loading' && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg flex items-center gap-2 text-violet-100 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Identifying song (ACRCloud)…</span>
                </div>
              )}
              {showVenueAndShowFields && auddStatus === 'done' && (
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
              {showVenueAndShowFields && auddStatus === 'error' && auddMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm">{auddMessage}</p>
                </div>
              )}
              {!BYPASS_CONTENT_FEED_BIFURCATION &&
                classifyStatus === 'loading' &&
                !canPostWithShowDetails && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg flex items-center gap-2 text-sky-100 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Checking music match…</span>
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
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-100 text-sm">{classifyMessage}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    You can still share — we may fill artist and venue during upload.
                  </p>
                </div>
              )}

              {showVenueAndShowFields && (
              <div className="rounded-lg border border-white/15 bg-white/[0.06] p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-momentum-flare/90">
                  Show
                </div>
                {isShowMatching ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      {libraryMetaReading
                        ? 'Reading location from your video file…'
                        : uploadSource === 'library'
                          ? 'Matching show from GPS embedded in your video…'
                          : 'Matching your recording to a nearby show…'}
                    </p>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-momentum-flare/90 transition-[width] duration-100 ease-linear"
                        style={{ width: `${showResolveProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {captionEventTitle ? (
                      <p className="text-lg sm:text-xl font-bold text-white leading-snug">
                        {captionEventTitle}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {uploadSource === 'library'
                          ? 'Add artist and venue below, or pick from JamBase search results.'
                          : 'Event title will appear when we match your recording to a nearby show.'}
                      </p>
                    )}
                    {(showMatchFilled || uploadSource !== 'library') && (
                      <>
                        <div className="flex items-start gap-2 text-white border-t border-white/10 pt-3">
                          <MapPin className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {formData.venue_name || 'Venue not set yet'}
                            </p>
                            <p className="text-sm text-gray-300 break-words">
                              {formData.location ||
                                'Location will appear from your GPS or after you pick a show.'}
                            </p>
                          </div>
                        </div>
                        {formData.artist_name ? (
                          <div className="flex items-center gap-2 text-gray-300 text-sm">
                            <Music className="w-4 h-4 text-momentum-rose shrink-0" />
                            <span>{formData.artist_name}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                    {uploadSource !== 'library' ? (
                      <p className="text-xs text-gray-500">
                        Filled automatically when we match your recording to a nearby venue. Use
                        &quot;Change Artist/Venue&quot; below to edit.
                      </p>
                    ) : showMatchFilled ? (
                      <p className="text-xs text-gray-500">
                        Matched from your video file. Use &quot;Change Artist/Venue&quot; below to
                        edit.
                      </p>
                    ) : null}
                  </>
                )}
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

              {showVenueAndShowFields && auddStatus !== 'loading' && (
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

              {showVenueAndShowFields && (
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

              {showVenueAndShowFields && (
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

                    <div>
                      <label className="block text-gray-400 text-xs mb-1 font-medium">
                        Event title
                      </label>
                      <input
                        type="text"
                        value={jambaseLink?.eventTitle ?? captionEventTitle ?? ''}
                        onChange={(e) => handleEventTitleChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare text-sm"
                        placeholder="Artist at Venue"
                        autoComplete="off"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Required to post without a song match — e.g. &quot;Taylor Swift at Madison Square Garden&quot;.
                      </p>
                    </div>

                    <div>
                      <label className="block text-gray-400 text-xs mb-1 font-medium">
                        Show date
                      </label>
                      <input
                        type="date"
                        value={isoToDateInputValue(recordingAtIso)}
                        onChange={(e) => handleCaptureDateChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-momentum-flare text-sm [color-scheme:dark]"
                      />
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
                      <span>Recorded {displayEventDate}</span>
                    </div>
                  </div>
                )}
              </div>
              )}

              {showVenueAndShowFields && (
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
                  disabled={clipUploadsInFlight >= 5}
                  onClick={() => void handleSubmit(null)}
                  className="w-full px-6 py-4 md:px-[1.65rem] md:py-[1.1rem] momentum-grad-interactive rounded-xl font-bold text-white text-lg md:text-[1.2375rem] hover:scale-[1.02] md:hover:scale-[1.12] transition-transform active:scale-[0.98] shadow-lg shadow-momentum-ember/35 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isPrePostClip ? 'Share talking moment' : 'Share your moment'}
                </button>
                {!canPostWithShowDetails && !isPrePostClip ? (
                  <p className="text-center text-xs text-gray-400">
                    Artist and venue are optional — we will try to match them from your recording
                    location while this clip uploads.
                  </p>
                ) : null}
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
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={clipUploadsInFlight >= 5}
              className="flex-1 px-6 py-4 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              Share It
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
