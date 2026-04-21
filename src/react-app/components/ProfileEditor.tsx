import { useState, useRef } from 'react';
import { X, Upload, Loader2, Camera, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';
import type { UserProfile } from '@/shared/types';

interface ProfileEditorProps {
  profile: UserProfile;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ProfileEditor({ profile, onClose, onUpdate }: ProfileEditorProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    display_name: profile.display_name || '',
    bio: profile.bio || '',
    location: profile.location || '',
    city: profile.city || '',
    profile_image_url: profile.profile_image_url || '',
    cover_image_url: profile.cover_image_url || '',
    genres: profile.genres ? JSON.parse(profile.genres) : [],
    social_links: profile.social_links ? JSON.parse(profile.social_links) : {},
  });

  const handleImageUpload = async (file: File, type: 'avatar' | 'cover') => {
    setUploading(type);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'thumbnail');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        [type === 'avatar' ? 'profile_image_url' : 'cover_image_url']: data.url
      }));
    } catch (err) {
      setError('Failed to upload image. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      handleImageUpload(file, type);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          genres: formData.genres,
          social_links: formData.social_links,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setSuccess(true);
      setTimeout(() => {
        onUpdate();
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Update error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="max-w-3xl w-full bg-gradient-to-b from-slate-900 to-black border border-cyan-500/20 rounded-xl my-8 animate-scale-in">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-lg border-b border-white/10 p-4 sm:p-6 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Edit Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Cover Image */}
          <div>
            <label className="block text-white font-medium mb-2">Cover Image</label>
            <div className="relative h-32 sm:h-48 bg-gradient-to-r from-purple-900/50 to-black rounded-xl overflow-hidden border-2 border-dashed border-white/20 group hover:border-cyan-400/50 transition-colors">
              {formData.cover_image_url ? (
                <img
                  src={formData.cover_image_url}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600" />
                </div>
              )}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading === 'cover'}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploading === 'cover' ? (
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-white mx-auto mb-2" />
                    <span className="text-white text-sm">Upload Cover</span>
                  </div>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'cover')}
                className="hidden"
              />
            </div>
          </div>

          {/* Profile Image */}
          <div>
            <label className="block text-white font-medium mb-2">Profile Image</label>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={formData.profile_image_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=200&h=200&fit=crop&crop=face'}
                  alt="Profile"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-cyan-500/40"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading === 'avatar'}
                  className="absolute inset-0 bg-black/60 rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploading === 'avatar' ? (
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'avatar')}
                  className="hidden"
                />
              </div>
              <div className="text-sm text-gray-400">
                <p>Click to upload new image</p>
                <p className="text-xs">Max size: 5MB</p>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-white font-medium mb-2">Display Name</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
              placeholder="Enter your display name"
              required
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-white font-medium mb-2">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 resize-none"
              placeholder="Tell us about yourself..."
              maxLength={500}
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {formData.bio.length}/500
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-medium mb-2">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="New York, NY"
              />
            </div>
            {profile.role === 'ambassador' && (
              <div>
                <label className="block text-white font-medium mb-2">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  placeholder="New York"
                />
              </div>
            )}
          </div>

          {/* Genres */}
          <div>
            <label className="block text-white font-medium mb-2">Favorite Genres</label>
            <div className="flex flex-wrap gap-2">
              {['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'R&B', 'Latin', 'Jazz', 'Country', 'Indie', 'Metal'].map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    const genres = formData.genres.includes(genre)
                      ? formData.genres.filter((g: string) => g !== genre)
                      : [...formData.genres, genre];
                    setFormData(prev => ({ ...prev, genres }));
                  }}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all tap-feedback ${
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

          {/* Social Links */}
          <div>
            <label className="block text-white font-medium mb-2">Social Links (Optional)</label>
            <div className="space-y-3">
              <input
                type="url"
                value={formData.social_links.instagram || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, instagram: e.target.value }
                }))}
                className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Instagram URL"
              />
              <input
                type="url"
                value={formData.social_links.twitter || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, twitter: e.target.value }
                }))}
                className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Twitter URL"
              />
              <input
                type="url"
                value={formData.social_links.website || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, website: e.target.value }
                }))}
                className="w-full px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                placeholder="Website URL"
              />
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 animate-slide-up">
              <Check className="w-5 h-5 flex-shrink-0 animate-scale-in" />
              <span className="text-sm">Profile updated successfully!</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold text-white hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading !== null}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
