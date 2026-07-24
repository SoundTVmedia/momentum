import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Heart, Eye, Video, Users, UserPlus, UserMinus, Loader2, MapPin, Edit, Shield, Star, TrendingUp } from 'lucide-react';
import Header from '@/react-app/components/Header';
import OwnProfileHub from '@/react-app/components/OwnProfileHub';
import ClipModal from '@/react-app/components/ClipModal';
import ProfileEditor from '@/react-app/components/ProfileEditor';
import UserAvatar from '@/react-app/components/UserAvatar';
import VerificationRequest from '@/react-app/components/VerificationRequest';
import FollowingUsersModal from '@/react-app/components/FollowingUsersModal';
import { useFollow } from '@/react-app/hooks/useFollow';
import { useUserStats } from '@/react-app/hooks/useUserStats';
import type { ClipWithUser, ExtendedMochaUser, UserProfile } from '@/shared/types';
import { isSuperAdminUser } from '@/react-app/lib/program-nav';
import { displayMediaUrl } from '@/shared/media-proxy';
import SuperadminProfileModerationBar from '@/react-app/components/SuperadminProfileModerationBar';
import ClipFeedCarousel from '@/react-app/components/ClipFeedCarousel';
import { useQuickCapture } from '@/react-app/contexts/QuickCaptureContext';
import { PAGE_CAROUSEL_BLEED } from '@/react-app/lib/homeFeedLayout';
import { artistPath } from '@/shared/app-paths';

interface UserStats {
  totalClips: number;
  totalLikes: number;
  totalViews: number;
  followers: number;
  following: number;
}

interface UserProfileData {
  profile: UserProfile;
  clips: ClipWithUser[];
  stats: UserStats;
}

interface FavoriteArtistWithClips {
  artist: {
    artist_id: number;
    name: string;
    image_url: string | null;
    bio: string | null;
  };
  clips: ClipWithUser[];
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const { toggleFollow, isFollowing, isLoading: followLoading, hydrated: followHydrated } = useFollow();
  const { stats: lifetimeStats } = useUserStats(userId || '');
  const [data, setData] = useState<UserProfileData | null>(null);
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtistWithClips[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [profileModalFeed, setProfileModalFeed] = useState<ClipWithUser[] | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);
  const [likedClipsCount, setLikedClipsCount] = useState<number | null>(null);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  const isOwnProfile = user?.id === userId;
  const showSuperadminModeration =
    !isOwnProfile && isSuperAdminUser(extendedUser) && !!userId;
  const quickCapture = useQuickCapture();

  const fetchUserProfile = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profileData = await response.json();
      setData(profileData);

      // Track profile view (async, don't wait)
      fetch(`/api/analytics/profile-view/${userId}`, { method: 'POST' }).catch(() => {});

      const viewingOwnProfile = user?.id === userId;
      if (viewingOwnProfile) {
        setFavoriteArtists([]);
      } else {
        const favoritesResponse = await fetch(`/api/users/${userId}/favorite-artists-with-clips`);
        if (favoritesResponse.ok) {
          const favoritesData = await favoritesResponse.json();
          setFavoriteArtists(favoritesData.favoriteArtists || []);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  useEffect(() => {
    if (!isOwnProfile) return;
    const onFollowingChanged = () => void fetchUserProfile();
    window.addEventListener('following-changed', onFollowingChanged);
    return () => window.removeEventListener('following-changed', onFollowingChanged);
  }, [isOwnProfile, userId]);

  useEffect(() => {
    if (!isOwnProfile || !user) {
      setLikedClipsCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/users/me/liked-clips', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as { clip_ids?: number[] };
        if (!cancelled) {
          setLikedClipsCount((data.clip_ids ?? []).length);
        }
      } catch {
        if (!cancelled) setLikedClipsCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user]);

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-momentum-flare animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen text-white">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'User not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, clips, stats } = data;
  const genres = profile.genres ? JSON.parse(profile.genres) : [];

  return (
    <div className="min-h-screen text-white">
      <Header />
      
      {/* Profile Header */}
      <div className="relative">
        {/* Cover Image */}
        {profile.cover_image_url && (
          <div 
            className="h-32 sm:h-48 md:h-64 bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.cover_image_url})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black"></div>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          {showSuperadminModeration && userId ? (
            <div className="pt-6">
              <SuperadminProfileModerationBar
                targetUserId={userId}
                targetDisplayName={profile.display_name}
                onUpdated={() => void fetchUserProfile()}
              />
            </div>
          ) : null}
          <div className="relative pb-6 sm:pb-8">
            {/* Profile Image */}
            <div className={`flex flex-col md:flex-row items-center md:items-end space-y-3 sm:space-y-4 md:space-y-0 md:space-x-6 ${profile.cover_image_url ? '-mt-12 sm:-mt-16' : 'pt-6 sm:pt-8'}`}>
              <UserAvatar
                imageUrl={profile.profile_image_url}
                displayName={profile.display_name}
                seed={profile.mocha_user_id}
                alt={profile.display_name || 'User'}
                sizeClass="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40"
                letterClassName="text-3xl sm:text-4xl md:text-5xl font-semibold"
                className="border-4 border-black shadow-xl"
              />
              
              <div className="flex-1 text-center md:text-left pb-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                      {profile.display_name || 'Anonymous User'}
                    </h1>
                    <div className="flex items-center justify-center md:justify-start space-x-2 text-sm sm:text-base text-gray-400">
                      <span className="capitalize">{profile.role}</span>
                      {profile.is_verified === 1 && (
                        <div className="bg-momentum-flare rounded-full p-0.5 sm:p-1">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isOwnProfile && user && (
                    <button
                      onClick={() => userId && toggleFollow(userId)}
                      disabled={!followHydrated || followLoading(userId || '')}
                      className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center space-x-2 ${
                        isFollowing(userId || '')
                          ? 'bg-white/10 border border-momentum-ember/50 text-white'
                          : 'momentum-grad-interactive text-white'
                      }`}
                    >
                      {isFollowing(userId || '') ? (
                        <>
                          <UserMinus className="w-5 h-5" />
                          <span>Unfollow</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}

                  {isOwnProfile && (
                    <div className="mt-3 sm:mt-4 flex gap-2 justify-center md:hidden">
                      <button
                        onClick={() => setShowProfileEditor(true)}
                        className="px-4 py-2 sm:px-6 sm:py-3 bg-white/10 border border-momentum-ember/50 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors flex items-center space-x-2 text-sm sm:text-base"
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Edit Profile</span>
                      </button>
                      {profile.is_verified === 0 && ['artist', 'venue', 'influencer'].includes(profile.role) && (
                        <button
                          onClick={() => setShowVerificationRequest(true)}
                          className="px-3 py-2 sm:px-4 sm:py-3 bg-momentum-flare/20 border border-momentum-flare/50 rounded-xl text-momentum-flare hover:bg-momentum-flare/30 transition-colors"
                          title="Request Verification"
                        >
                          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {profile.location && (
                  <div className="flex items-center justify-center md:justify-start space-x-1 text-gray-400 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                
                {profile.bio && (
                  <p className="text-gray-300 max-w-2xl mb-4">{profile.bio}</p>
                )}
                
                {(genres.length > 0 || isOwnProfile) && (
                  <div
                    className={`flex flex-col gap-3 ${
                      isOwnProfile
                        ? 'md:flex-row md:items-end md:gap-4 ' +
                          (genres.length > 0 ? 'md:justify-between' : 'md:justify-end')
                        : ''
                    }`}
                  >
                    {genres.length > 0 ? (
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start md:flex-1 md:min-w-0">
                        {genres.map((genre: string) => (
                          <span
                            key={genre}
                            className="px-3 py-1 bg-momentum-ember/20 text-momentum-flare text-sm rounded-full"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {isOwnProfile && (
                      <div className="hidden md:flex gap-2 shrink-0">
                        <button
                          onClick={() => setShowProfileEditor(true)}
                          className="px-6 py-3 bg-white/10 border border-momentum-ember/50 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors flex items-center space-x-2 text-base"
                        >
                          <Edit className="w-5 h-5" />
                          <span>Edit Profile</span>
                        </button>
                        {profile.is_verified === 0 && ['artist', 'venue', 'influencer'].includes(profile.role) && (
                          <button
                            onClick={() => setShowVerificationRequest(true)}
                            className="px-4 py-3 bg-momentum-flare/20 border border-momentum-flare/50 rounded-xl text-momentum-flare hover:bg-momentum-flare/30 transition-colors"
                            title="Request Verification"
                          >
                            <Shield className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mt-6 sm:mt-8">
              <div className="glass-panel rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-momentum-flare" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalClips}</div>
                <div className="text-xs sm:text-sm text-gray-400">Clips</div>
              </div>
              
              {isOwnProfile && user ? (
                <button
                  type="button"
                  onClick={() => navigate('/liked')}
                  className="glass-panel rounded-xl p-3 sm:p-4 text-center w-full hover:border-red-400/40 hover:bg-white/[0.08] transition-colors tap-feedback"
                  aria-label="View clips you've liked"
                >
                  <div className="flex items-center justify-center mb-1 sm:mb-2">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white">
                    {(likedClipsCount ?? stats.totalLikes).toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400">Liked</div>
                </button>
              ) : (
                <div className="glass-panel rounded-xl p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1 sm:mb-2">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalLikes.toLocaleString()}</div>
                  <div className="text-xs sm:text-sm text-gray-400">Likes</div>
                </div>
              )}
              
              <div className="glass-panel rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-momentum-flare" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalViews.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Views</div>
              </div>
              
              <div className="glass-panel rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-momentum-rose" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.followers.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Followers</div>
              </div>
              
              {isOwnProfile && user ? (
                <button
                  type="button"
                  onClick={() => setShowFollowingModal(true)}
                  className="glass-panel rounded-xl p-3 sm:p-4 text-center w-full hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="View users you follow"
                >
                  <div className="flex items-center justify-center mb-1 sm:mb-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{stats.following.toLocaleString()}</div>
                  <div className="text-xs sm:text-sm text-gray-400">Following</div>
                </button>
              ) : (
                <div className="glass-panel rounded-xl p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center mb-1 sm:mb-2">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-white">{stats.following.toLocaleString()}</div>
                  <div className="text-xs sm:text-sm text-gray-400">Following</div>
                </div>
              )}
            </div>

            {/* Lifetime Feedback stats */}
            {lifetimeStats && (
              <div className="mt-6 sm:mt-8 bg-gradient-to-r from-momentum-ember/12 to-momentum-flare/8 border border-momentum-ember/30 rounded-xl p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-momentum-flare" />
                  <h3 className="text-lg sm:text-xl font-bold text-white">Lifetime Feedback Stats</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-momentum-flare">{lifetimeStats.totalClipsPosted}</div>
                    <div className="text-sm text-gray-400">Moments Posted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-momentum-flare">{lifetimeStats.totalViewsOnClips.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">Moments Watched</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Star className="w-5 h-5 text-momentum-ember fill-current" />
                      <div className="text-2xl sm:text-3xl font-bold text-momentum-ember">
                        {lifetimeStats.userAverageClipRating > 0 ? lifetimeStats.userAverageClipRating.toFixed(1) : 'N/A'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">User Score</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isOwnProfile && user ? (
          <OwnProfileHub onOpenCapture={quickCapture.openQuickCapture} />
        ) : null}

        {/* Favorite Artists — other users' profiles only (own profile ends at shows carousel) */}
        {favoriteArtists.length > 0 && !isOwnProfile && (
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center space-x-2">
              <Star className="w-6 h-6 text-momentum-ember" />
              <span>Favorite Artists</span>
            </h2>
            
            <div className="space-y-6">
              {favoriteArtists.map((favoriteArtist) => (
                <div key={favoriteArtist.artist.artist_id} className="glass-panel border border-momentum-rose/20 rounded-xl p-4 sm:p-6">
                  <button
                    onClick={() => navigate(artistPath(favoriteArtist.artist.name))}
                    className="flex items-center space-x-4 mb-4 hover:opacity-80 transition-opacity"
                  >
                    {favoriteArtist.artist.image_url && (
                      <img
                        src={displayMediaUrl(favoriteArtist.artist.image_url)}
                        alt={favoriteArtist.artist.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-momentum-rose/40"
                      />
                    )}
                    <div className="text-left">
                      <h3 className="text-xl font-bold text-white">{favoriteArtist.artist.name}</h3>
                      {favoriteArtist.clips.length > 0 && (
                        <p className="text-sm text-gray-400">{favoriteArtist.clips.length} favorite moments</p>
                      )}
                    </div>
                  </button>

                  {favoriteArtist.clips.length > 0 ? (
                    <ClipFeedCarousel
                      clips={favoriteArtist.clips}
                      className={PAGE_CAROUSEL_BLEED}
                      ariaLabel={`${favoriteArtist.artist.name} favorite moments`}
                      onOpenClip={(clip) => {
                        setSelectedClip(clip);
                        setProfileModalFeed(
                          favoriteArtist.clips.length > 1 ? favoriteArtist.clips : null
                        );
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-4">No favorite moments yet</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public profile clips — own profile uses My clips carousel in OwnProfileHub */}
        {!isOwnProfile ? (
          <>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {`${profile.display_name}'s Clips`}
        </h2>
        
        {clips.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-xl">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              Nothing here yet
            </p>
          </div>
        ) : (
          <ClipFeedCarousel
            clips={clips}
            className={PAGE_CAROUSEL_BLEED}
            ariaLabel={`${profile.display_name}'s clips`}
            onOpenClip={(clip) => {
              setSelectedClip(clip);
              setProfileModalFeed(clips.length > 1 ? clips : null);
            }}
          />
        )}
          </>
        ) : null}
      </div>

      {/* Modals */}
      {selectedClip && (
        <ClipModal
          clip={selectedClip}
          onClose={() => {
            setSelectedClip(null);
            setProfileModalFeed(null);
          }}
          feedNavigation={
            profileModalFeed && profileModalFeed.length > 1
              ? { clips: profileModalFeed, onChangeClip: setSelectedClip }
              : null
          }
        />
      )}

      {showProfileEditor && data && (
        <ProfileEditor
          profile={data.profile}
          onClose={() => setShowProfileEditor(false)}
          onUpdate={fetchUserProfile}
        />
      )}

      {showVerificationRequest && data && (
        <VerificationRequest
          onClose={() => setShowVerificationRequest(false)}
          userRole={data.profile.role}
        />
      )}

      {showFollowingModal ? (
        <FollowingUsersModal
          onClose={() => setShowFollowingModal(false)}
          onFollowingChanged={() => void fetchUserProfile()}
        />
      ) : null}
    </div>
  );
}
