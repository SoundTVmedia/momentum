import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { Users, Music, Star, Award, Crown, X, MapPin, Search, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';

type UserRole = 'fan' | 'artist' | 'ambassador' | 'influencer' | 'premium';

interface RoleOption {
  value: UserRole;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: string;
}

const roleOptions: RoleOption[] = [
  {
    value: 'fan',
    icon: Users,
    label: 'Fan',
    description: 'Drop clips, find shows, connect with the community',
    color: 'from-cyan-500 to-blue-600'
  },
  {
    value: 'artist',
    icon: Music,
    label: 'Artist/Venue',
    description: 'Connect with your fans, share exclusive content, promote shows',
    color: 'from-purple-500 to-pink-600'
  },
  {
    value: 'ambassador',
    icon: Award,
    label: 'Ambassador',
    description: 'Rep your city\'s scene, earn commissions, get featured',
    color: 'from-orange-500 to-red-600'
  },
  {
    value: 'influencer',
    icon: Star,
    label: 'Influencer',
    description: 'Curate the best moments, collab with artists, build your following',
    color: 'from-yellow-500 to-orange-600'
  },
  {
    value: 'premium',
    icon: Crown,
    label: 'Premium Member',
    description: 'VIP treatment, exclusive drops, early tickets, all the perks',
    color: 'from-yellow-400 to-amber-600'
  }
];

const popularArtists = [
  'Taylor Swift', 'The Weeknd', 'Drake', 'Billie Eilish', 'Bad Bunny',
  'Ed Sheeran', 'Ariana Grande', 'Beyoncé', 'Post Malone', 'Olivia Rodrigo',
  'Travis Scott', 'Dua Lipa', 'Harry Styles', 'SZA', 'Morgan Wallen',
  'Luke Combs', 'Peso Pluma', 'Karol G', 'Future', '21 Savage'
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { getCurrentPosition } = useGeolocation();
  
  const [selectedRole, setSelectedRole] = useState<UserRole>('fan');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    location: '',
    city: '',
    genres: [] as string[],
  });

  // Personalization state
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [artistSearch, setArtistSearch] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [homeLatitude, setHomeLatitude] = useState<number | null>(null);
  const [homeLongitude, setHomeLongitude] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState(50);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth');
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const fromOAuth =
      user.google_user_data?.name?.trim() ||
      user.email?.split('@')[0] ||
      '';
    if (fromOAuth) {
      setFormData((prev) => ({
        ...prev,
        displayName: prev.displayName || fromOAuth,
      }));
    }
  }, [user]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFavoriteArtist = (artist: string) => {
    setFavoriteArtists(prev => 
      prev.includes(artist) 
        ? prev.filter(a => a !== artist)
        : [...prev, artist]
    );
  };

  const addCustomArtist = () => {
    if (artistSearch.trim() && !favoriteArtists.includes(artistSearch.trim())) {
      setFavoriteArtists(prev => [...prev, artistSearch.trim()]);
      setArtistSearch('');
    }
  };

  const handleGetCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const response = await fetch(
        `/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          formattedAddress?: string | null;
        };
        setHomeLocation(
          data.formattedAddress?.trim() ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        );
        setHomeLatitude(lat);
        setHomeLongitude(lng);
      } else if (response.status === 503) {
        setHomeLocation('Current location');
        setHomeLatitude(lat);
        setHomeLongitude(lng);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const displayName = formData.displayName.trim();
    if (!displayName) {
      setSubmitError('Please enter a display name.');
      return;
    }

    setSubmitting(true);

    try {
      const profileRes = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: selectedRole,
          display_name: displayName,
          bio: formData.bio,
          location: formData.location,
          city: formData.city,
          genres: formData.genres,
        }),
      });

      if (!profileRes.ok) {
        let msg = 'Could not save your profile.';
        try {
          const errBody = (await profileRes.json()) as { error?: string };
          if (errBody.error) {
            msg = errBody.error;
          }
        } catch {
          /* use default */
        }
        setSubmitError(msg);
        return;
      }

      const personalizationRes = await fetch('/api/personalization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          favorite_artists: favoriteArtists,
          home_location: homeLocation,
          home_latitude: homeLatitude,
          home_longitude: homeLongitude,
          location_radius_miles: locationRadius,
          personalization_enabled: true,
        }),
      });

      if (!personalizationRes.ok) {
        let msg = 'Profile saved, but personalization settings failed.';
        try {
          const errBody = (await personalizationRes.json()) as { error?: string };
          if (errBody.error) {
            msg = errBody.error;
          }
        } catch {
          /* use default */
        }
        setSubmitError(msg);
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredArtists = popularArtists.filter(artist =>
    artist.toLowerCase().includes(artistSearch.toLowerCase())
  );

  if (isPending || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
              Welcome to the Scene
            </span>
          </h1>
          <p className="text-xl text-gray-300">Let's get you set up</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 1 ? 'bg-cyan-500' : 'bg-cyan-500/50'}`}>
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div className="w-16 h-1 bg-gray-700" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 2 ? 'bg-cyan-500' : step > 2 ? 'bg-cyan-500/50' : 'bg-gray-700'}`}>
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <div className="w-16 h-1 bg-gray-700" />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 3 ? 'bg-cyan-500' : 'bg-gray-700'}`}>
              <span className="text-white font-bold text-sm">3</span>
            </div>
          </div>
        </div>

        {/* Step 1: Choose Role */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center mb-8">How Will You Vibe?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleRoleSelect(option.value)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      selectedRole === option.value
                        ? 'border-cyan-400 bg-black/60 scale-105'
                        : 'border-gray-700 bg-black/40 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${option.color}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{option.label}</h3>
                        <p className="text-gray-300 text-sm">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={() => setStep(2)}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Complete Your Profile</h2>
              <button
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                    placeholder="New York, NY"
                  />
                </div>

                {selectedRole === 'ambassador' && (
                  <div>
                    <label className="block text-white font-medium mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                      placeholder="New York"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Favorite Genres</label>
                <div className="flex flex-wrap gap-2">
                  {['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'R&B', 'Latin', 'Jazz', 'Country'].map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        const genres = formData.genres.includes(genre)
                          ? formData.genres.filter(g => g !== genre)
                          : [...formData.genres, genre];
                        handleInputChange('genres', genres);
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        formData.genres.includes(genre)
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-4 mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-8 py-4 bg-black/30 border border-cyan-500/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Personalization */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Personalize Your Feed</h2>
              <button
                onClick={() => setStep(2)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8 space-y-8">
              {/* Favorite Artists */}
              <div>
                <label className="block text-white font-medium mb-4">
                  Favorite Artists
                  <span className="text-gray-400 text-sm ml-2">(Select at least 3)</span>
                </label>
                
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={artistSearch}
                      onChange={(e) => setArtistSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCustomArtist()}
                      className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                      placeholder="Search or add custom artist..."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {favoriteArtists.map((artist) => (
                    <button
                      key={artist}
                      onClick={() => toggleFavoriteArtist(artist)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-white text-sm font-medium hover:scale-105 transition-transform"
                    >
                      {artist} ×
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {filteredArtists.filter(artist => !favoriteArtists.includes(artist)).map((artist) => (
                    <button
                      key={artist}
                      onClick={() => toggleFavoriteArtist(artist)}
                      className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-gray-300 text-sm font-medium hover:bg-white/20 transition-all"
                    >
                      {artist}
                    </button>
                  ))}
                </div>
              </div>

              {/* Home Location */}
              <div>
                <label className="block text-white font-medium mb-4">
                  Home Location
                  <span className="text-gray-400 text-sm ml-2">(For nearby show recommendations)</span>
                </label>
                
                <div className="space-y-4">
                  <button
                    onClick={handleGetCurrentLocation}
                    disabled={loadingLocation}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all disabled:opacity-50"
                  >
                    {loadingLocation ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Getting your location...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-5 h-5" />
                        <span>Use Current Location</span>
                      </>
                    )}
                  </button>

                  {homeLocation && (
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-white font-medium mb-2">Selected Location:</p>
                      <p className="text-gray-300 text-sm">{homeLocation}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-gray-300 text-sm mb-2">
                      Search Radius: {locationRadius} miles
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={locationRadius}
                      onChange={(e) => setLocationRadius(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>10 mi</span>
                      <span>200 mi</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-purple-300 text-sm">
                  <strong>Why personalize?</strong> We'll show you clips and concerts from your favorite artists and shows near you. You can update these preferences anytime in your settings.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                {submitError}
              </div>
            )}

            <div className="flex justify-center space-x-4 mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={submitting}
                className="px-8 py-4 bg-black/30 border border-cyan-500/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={favoriteArtists.length < 3 || submitting}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? (
                  <span className="flex items-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Setting up your profile...</span>
                  </span>
                ) : (
                  'Complete Setup'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
