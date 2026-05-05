import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Heart, Eye, Video, Users, UserPlus, UserCheck, Loader2, MapPin, Edit, Shield, Star, TrendingUp } from 'lucide-react';
import Header from '@/react-app/components/Header';
import ClipModal from '@/react-app/components/ClipModal';
import ProfileEditor from '@/react-app/components/ProfileEditor';
import VerificationRequest from '@/react-app/components/VerificationRequest';
import { useFollow } from '@/react-app/hooks/useFollow';
import { useUserStats } from '@/react-app/hooks/useUserStats';
import type { ClipWithUser, UserProfile } from '@/shared/types';
import { clipListItemKey } from '@/react-app/lib/clip-list-key';
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
  const { toggleFollow, isFollowing, isLoading: followLoading } = useFollow();
  const { stats: lifetimeStats } = useUserStats(userId || '');
  const [data, setData] = useState<UserProfileData | null>(null);
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtistWithClips[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<ClipWithUser | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showVerificationRequest, setShowVerificationRequest] = useState(false);

  const isOwnProfile = user?.id === userId;

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

      // Fetch favorite artists with clips
      const favoritesResponse = await fetch(`/api/users/${userId}/favorite-artists-with-clips`);
      if (favoritesResponse.ok) {
        const favoritesData = await favoritesResponse.json();
        setFavoriteArtists(favoritesData.favoriteArtists || []);
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'User not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
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
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
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
          <div className="relative pb-6 sm:pb-8">
            {/* Profile Image */}
            <div className={`flex flex-col md:flex-row items-center md:items-end space-y-3 sm:space-y-4 md:space-y-0 md:space-x-6 ${profile.cover_image_url ? '-mt-12 sm:-mt-16' : 'pt-6 sm:pt-8'}`}>
              <img
                src={profile.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=200&h=200&fit=crop&crop=face'}
                alt={profile.display_name || 'User'}
                className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full border-4 border-black object-cover shadow-xl"
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
                        <div className="bg-blue-500 rounded-full p-0.5 sm:p-1">
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
                      disabled={followLoading(userId || '')}
                      className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform flex items-center space-x-2 ${
                        isFollowing(userId || '')
                          ? 'bg-white/10 border border-cyan-500/50 text-white'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      }`}
                    >
                      {isFollowing(userId || '') ? (
                        <>
                          <UserCheck className="w-5 h-5" />
                          <span>Following</span>
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
                    <div className="mt-3 sm:mt-4 md:mt-0 flex gap-2 justify-center md:justify-start">
                      <button
                        onClick={() => setShowProfileEditor(true)}
                        className="px-4 py-2 sm:px-6 sm:py-3 bg-white/10 border border-cyan-500/50 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors flex items-center space-x-2 text-sm sm:text-base"
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Edit Profile</span>
                      </button>
                      {profile.is_verified === 0 && ['artist', 'venue', 'influencer'].includes(profile.role) && (
                        <button
                          onClick={() => setShowVerificationRequest(true)}
                          className="px-3 py-2 sm:px-4 sm:py-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 hover:bg-blue-500/30 transition-colors"
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
                
                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {genres.map((genre: string) => (
                      <span
                        key={genre}
                        className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-sm rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mt-6 sm:mt-8">
              <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalClips}</div>
                <div className="text-xs sm:text-sm text-gray-400">Clips</div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalLikes.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Likes</div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.totalViews.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Views</div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.followers.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Followers</div>
              </div>
              
              <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-3 sm:p-4 text-center">
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white">{stats.following.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-400">Following</div>
              </div>
            </div>

            {/* Lifetime Momentum Stats */}
            {lifetimeStats && (
              <div className="mt-6 sm:mt-8 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg sm:text-xl font-bold text-white">Lifetime Momentum Stats</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-cyan-400">{lifetimeStats.totalClipsPosted}</div>
                    <div className="text-sm text-gray-400">Moments Posted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-400">{lifetimeStats.totalViewsOnClips.toLocaleString()}</div>
                    <div className="text-sm text-gray-400">Moments Watched</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Star className="w-5 h-5 text-yellow-400 fill-current" />
                      <div className="text-2xl sm:text-3xl font-bold text-yellow-400">
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
        {/* Favorite Artists Section */}
        {favoriteArtists.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center space-x-2">
              <Star className="w-6 h-6 text-yellow-400" />
              <span>Favorite Artists</span>
            </h2>
            
            <div className="space-y-8">
              {favoriteArtists.map((favoriteArtist) => (
                <div key={favoriteArtist.artist.artist_id} className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 sm:p-6">
                  <button
                    onClick={() => navigate(artistPath(favoriteArtist.artist.name))}
                    className="flex items-center space-x-4 mb-4 hover:opacity-80 transition-opacity"
                  >
                    {favoriteArtist.artist.image_url && (
                      <img
                        src={favoriteArtist.artist.image_url}
                        alt={favoriteArtist.artist.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/40"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favoriteArtist.clips.slice(0, 3).map((clip, index) => (
                        <div
                          key={clipListItemKey(clip, index)}
                          onClick={() => setSelectedClip(clip)}
                          className="bg-black/40 backdrop-blur-lg border border-purple-500/20 rounded-lg overflow-hidden hover:border-purple-400/50 transition-all cursor-pointer group"
                        >
                          <div className="relative aspect-video">
                            <img
                              src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                              alt="Concert moment"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-3">
                            {clip.content_description && (
                              <p className="text-gray-300 text-sm line-clamp-2">{clip.content_description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No favorite moments yet</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clips Grid */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          {isOwnProfile ? 'Your Clips' : `${profile.display_name}'s Clips`}
        </h2>
        
        {clips.length === 0 ? (
          <div className="text-center py-12 bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {isOwnProfile ? "No clips yet. Time to share!" : "Nothing here yet"}
            </p>
            {isOwnProfile && (
              <button
                onClick={() => navigate('/upload')}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Share Your First Moment
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {clips.map((clip, index) => (
              <div
                key={clipListItemKey(clip, index)}
                onClick={() => setSelectedClip(clip)}
                className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/50 transition-all cursor-pointer group"
              >
                <div className="relative aspect-video">
                  <img
                    src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop'}
                    alt="Concert moment"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  {clip.artist_name && (
                    <div className="font-bold text-purple-400 mb-1">{clip.artist_name}</div>
                  )}
                  {clip.content_description && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{clip.content_description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>{clip.likes_count}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Eye className="w-4 h-4" />
                        <span>{clip.views_count}</span>
                      </span>
                    </div>
                    <span>{formatTimestamp(clip.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedClip && (
        <ClipModal 
          clip={selectedClip} 
          onClose={() => setSelectedClip(null)} 
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
    </div>
  );
}
