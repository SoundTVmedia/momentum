import { useState, useEffect } from 'react';
import { MapPin, Search, Loader2, Heart, Save, X } from 'lucide-react';
import { useGeolocation } from '@/react-app/hooks/useGeolocation';

const popularArtists = [
  'Taylor Swift', 'The Weeknd', 'Drake', 'Billie Eilish', 'Bad Bunny',
  'Ed Sheeran', 'Ariana Grande', 'Beyoncé', 'Post Malone', 'Olivia Rodrigo',
  'Travis Scott', 'Dua Lipa', 'Harry Styles', 'SZA', 'Morgan Wallen',
  'Luke Combs', 'Peso Pluma', 'Karol G', 'Future', '21 Savage'
];

interface PersonalizationSettingsProps {
  onClose?: () => void;
}

export default function PersonalizationSettings({ onClose }: PersonalizationSettingsProps) {
  const { getCurrentPosition } = useGeolocation();
  
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [artistSearch, setArtistSearch] = useState('');
  const [homeLocation, setHomeLocation] = useState('');
  const [homeLatitude, setHomeLatitude] = useState<number | null>(null);
  const [homeLongitude, setHomeLongitude] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState(50);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentSettings = async () => {
      try {
        const response = await fetch('/api/users/me');
        const data = await response.json();
        
        if (data.profile) {
          setFavoriteArtists(data.profile.favorite_artists ? JSON.parse(data.profile.favorite_artists) : []);
          setHomeLocation(data.profile.home_location || '');
          setHomeLatitude(data.profile.home_latitude);
          setHomeLongitude(data.profile.home_longitude);
          setLocationRadius(data.profile.location_radius_miles || 50);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentSettings();
  }, []);

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
      
      const response = await fetch(
        `/api/google-maps/reverse-geocode?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setHomeLocation(data.formatted_address || 'Current Location');
        setHomeLatitude(position.coords.latitude);
        setHomeLongitude(position.coords.longitude);
      }
    } catch (error) {
      console.error('Failed to get location:', error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const response = await fetch('/api/personalization/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_artists: favoriteArtists,
          home_location: homeLocation,
          home_latitude: homeLatitude,
          home_longitude: homeLongitude,
          location_radius_miles: locationRadius,
          personalization_enabled: true,
        }),
      });

      if (response.ok) {
        onClose?.();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredArtists = popularArtists.filter(artist =>
    artist.toLowerCase().includes(artistSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-8">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-lg border border-cyan-500/20 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Heart className="w-6 h-6 text-pink-400" />
          <h2 className="text-2xl font-bold text-white">Personalization Settings</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Favorite Artists */}
      <div>
        <label className="block text-white font-medium mb-4">
          Favorite Artists
          <span className="text-gray-400 text-sm ml-2">(Get notified when they post new content)</span>
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

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>Save Settings</span>
          </>
        )}
      </button>
    </div>
  );
}
