import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';
import FavoriteArtistsJamBaseField from '@/react-app/components/FavoriteArtistsJamBaseField';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { getCurrentPosition } = useGeolocation();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    location: '',
    genres: [] as string[],
  });

  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
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

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGetCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const response = await fetch(
        `/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`,
        { credentials: 'include' },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          formattedAddress?: string | null;
        };
        setHomeLocation(
          data.formattedAddress?.trim() ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
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
          display_name: displayName,
          bio: formData.bio,
          location: formData.location,
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
          const errBody = (await personalizationRes.json()) as { error?: string; detail?: string };
          if (errBody.detail) msg = errBody.detail;
          else if (errBody.error) msg = errBody.error;
        } catch {
          /* use default */
        }
        setSubmitError(msg);
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isPending || !user) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-momentum-ember animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent">
              Welcome to the Scene
            </span>
          </h1>
          <p className="text-xl text-gray-300">Let's get you set up</p>
        </div>

        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 1 ? 'bg-momentum-ember' : 'bg-momentum-ember/50'
              }`}
            >
              <span className="text-white font-bold text-sm">1</span>
            </div>
            <div className="w-16 h-1 bg-gray-700" />
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 2 ? 'bg-momentum-ember' : 'bg-gray-700'
              }`}
            >
              <span className="text-white font-bold text-sm">2</span>
            </div>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              Complete Your Profile
            </h2>

            <div className="glass-panel rounded-xl p-8 space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare"
                  placeholder="New York, NY"
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Favorite Genres</label>
                <div className="flex flex-wrap gap-2">
                  {['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'R&B', 'Latin', 'Jazz', 'Country'].map(
                    (genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => {
                          const genres = formData.genres.includes(genre)
                            ? formData.genres.filter((g) => g !== genre)
                            : [...formData.genres, genre];
                          handleInputChange('genres', genres);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          formData.genres.includes(genre)
                            ? 'momentum-grad-interactive text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {genre}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-8">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-8 py-4 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Personalize Your Feed</h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="glass-panel rounded-xl p-8 space-y-8">
              <FavoriteArtistsJamBaseField
                favoriteArtists={favoriteArtists}
                setFavoriteArtists={setFavoriteArtists}
                labelExtra={<span className="text-gray-400 text-sm ml-2">(Select at least 3)</span>}
              />

              <div>
                <label className="block text-white font-medium mb-4">
                  Home Location
                  <span className="text-gray-400 text-sm ml-2">
                    (For nearby show recommendations)
                  </span>
                </label>

                <div className="space-y-4">
                  <button
                    type="button"
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
                    <div className="p-4 bg-momentum-ember/10 border border-momentum-ember/20 rounded-lg">
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
                      onChange={(e) => setLocationRadius(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>10 mi</span>
                      <span>200 mi</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-momentum-rose/10 border border-momentum-rose/20 rounded-lg">
                <p className="text-momentum-rose/80 text-sm">
                  <strong>Why personalize?</strong> We'll show you clips and concerts from your
                  favorite artists and shows near you. You can update these preferences anytime in
                  your settings.
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
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="px-8 py-4 bg-black/30 border border-momentum-ember/30 backdrop-blur-lg rounded-xl font-semibold text-white hover:bg-black/50 transition-all disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={favoriteArtists.length < 3 || submitting}
                className="px-8 py-4 momentum-grad-interactive rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
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
