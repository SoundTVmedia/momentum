import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Upload, MapPin, Music, Calendar, Hash, Loader2, X, Film, Image as ImageIcon, Search, Edit2, Check, Share2, Heart, MessageCircle, Bookmark } from 'lucide-react';
import Header from '@/react-app/components/Header';
import QuickRecordButton from '@/react-app/components/QuickRecordButton';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import type { JamBaseArtist, JamBaseVenue } from '@/shared/types';

export default function UploadClip() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPending } = useAuth();
  const { searchArtists, searchVenues, loading: jambaseLoading } = useJamBase();
  const { requestLocation } = useGeolocation();
  const [loading, setLoading] = useState(false);
  const [geoDetected, setGeoDetected] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ video: 0, thumbnail: 0 });
  const [error, setError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  
  // Quick capture modal state
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  
  // Check for quickCapture URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('quickCapture') === 'true') {
      setShowQuickCapture(true);
    }
  }, []);
  
  // Caption screen state
  const [showCaptionScreen, setShowCaptionScreen] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  
  // Confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [postedClip, setPostedClip] = useState<any | null>(null);
  
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
    }
    
    // Check if we received show data from auto-tagging
    if (location.state?.showData) {
      const showData = location.state.showData as any;
      setFormData(prev => ({
        ...prev,
        artist_name: showData.artist_name || '',
        venue_name: showData.venue_name || '',
        location: showData.location || '',
      }));
      
      // Pre-fill search fields
      if (showData.artist_name) setArtistSearch(showData.artist_name);
      if (showData.venue_name) setVenueSearch(showData.venue_name);
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

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        setError('Video file must be less than 500MB');
        return;
      }
      setFormData(prev => ({ ...prev, video_file: file }));
      setError(null);
    }
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

      // Upload video - prioritize Cloudflare Stream for better quality
      if (uploadMethod === 'file' && (formData.video_file || formData.video_blob)) {
        setUploadProgress(prev => ({ ...prev, video: 10 }));
        
        // Convert blob to file if needed
        let fileToUpload = formData.video_file;
        if (!fileToUpload && formData.video_blob) {
          fileToUpload = new File([formData.video_blob], `recording-${Date.now()}.webm`, { type: 'video/webm' });
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

      // Upload thumbnail if provided
      if (formData.thumbnail_file) {
        setUploadProgress(prev => ({ ...prev, thumbnail: 10 }));
        const thumbData = await uploadFile(formData.thumbnail_file, 'thumbnail');
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
        throw new Error('Failed to create clip');
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
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
    }
    navigate('/');
  };

  const handleBackToFeed = () => {
    setShowConfirmationModal(false);
    setPostedClip(null);
    navigate('/');
  };

  const handleCloseSuccessModal = () => {
    setShowConfirmationModal(false);
    setPostedClip(null);
    navigate('/dashboard');
  };

  const handleShareClip = async () => {
    if (!postedClip) return;

    const clipUrl = `${window.location.origin}/?clip=${postedClip.id}`;
    const shareText = `Check out this moment${postedClip.artist_name ? ` from ${postedClip.artist_name}` : ''}${postedClip.venue_name ? ` at ${postedClip.venue_name}` : ''} on MOMENTUM!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my MOMENTUM clip!',
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
            Your clip is live in the Momentum feed
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
            <div className="relative aspect-video bg-black">
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
          onClose={() => {
            setShowQuickCapture(false);
            // Remove query param
            window.history.replaceState({}, '', '/upload');
          }} 
        />
      </div>
    );
  }

  // CAPTION SCREEN - Shown after recording
  if (showCaptionScreen) {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    // Video player state
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);

    const togglePlay = () => {
      if (videoPreviewRef.current) {
        if (isPlaying) {
          videoPreviewRef.current.pause();
        } else {
          videoPreviewRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const toggleMute = () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
        <Header />
        
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Finalize Your Moment</h1>
            <p className="text-gray-400">Add context and share with the community</p>
          </div>

          <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden">
            {/* Video Preview with Controls */}
            <div className="relative aspect-video bg-black group">
              {videoBlobUrl && (
                <>
                  <video
                    ref={videoPreviewRef}
                    src={videoBlobUrl}
                    loop
                    muted={isMuted}
                    playsInline
                    className="w-full h-full object-cover"
                    onClick={togglePlay}
                  />
                  
                  {/* Video Controls Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Center Play/Pause Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={togglePlay}
                        className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        {isPlaying ? (
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
                          onClick={toggleMute}
                          className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          {isMuted ? (
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
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">{currentDate}</span>
                    </div>
                  </div>
                )}
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
                    'Post to Feed'
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-white">Share Your Moment</h1>
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white transition-colors"
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
