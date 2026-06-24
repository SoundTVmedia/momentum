import { useEffect, useState } from 'react';
import { Disc3, Loader2, Search, X } from 'lucide-react';
import type { ClipWithUser, JamBaseArtist, JamBaseVenue } from '@/shared/types';
import { CLIP_GENRE_OPTIONS } from '@/shared/music-genres';
import type { DashboardGridClip } from '@/react-app/components/DashboardClipsGrid';
import ClipSongRecognitionControl from '@/react-app/components/ClipSongRecognitionControl';
import { clipNumericId } from '@/react-app/lib/clip-numeric-id';
import { saveClipMetadataFields } from '@/react-app/lib/applyClipSongRecognition';
import { hashtagsToInput } from '@/react-app/lib/clipFormFields';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import { useDebounce } from '@/react-app/hooks/useDebounce';

type EditableClip = ClipWithUser | DashboardGridClip;

type ClipEditModalProps = {
  clip: EditableClip;
  onClose: () => void;
  onSaved: (updated: ClipWithUser) => void;
  /** When true, saves via admin API and allows JamBase show linking. */
  asSuperadmin?: boolean;
};

function readClipString(clip: EditableClip, key: string): string {
  const value = (clip as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function readClipNullableString(clip: EditableClip, key: string): string | null {
  const value = (clip as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export default function ClipEditModal({
  clip,
  onClose,
  onSaved,
  asSuperadmin = false,
}: ClipEditModalProps) {
  const { searchArtists, searchVenues } = useJamBase();
  const [artistName, setArtistName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [genreName, setGenreName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [jambaseEventId, setJambaseEventId] = useState<string | null>(null);
  const [jambaseArtistId, setJambaseArtistId] = useState<string | null>(null);
  const [jambaseVenueId, setJambaseVenueId] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState<JamBaseArtist[]>([]);
  const [venueSuggestions, setVenueSuggestions] = useState<JamBaseVenue[]>([]);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);
  const [artistSearchPending, setArtistSearchPending] = useState(false);
  const [venueSearchPending, setVenueSearchPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedArtistSearch = useDebounce(artistSearch, 300);
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  useEffect(() => {
    setArtistName(readClipString(clip, 'artist_name'));
    setVenueName(readClipString(clip, 'venue_name'));
    setLocation(readClipString(clip, 'location'));
    setDescription(readClipString(clip, 'content_description'));
    setHashtags(hashtagsToInput(clip.hashtags));
    setSongTitle(readClipString(clip, 'song_title'));
    setGenreName(readClipString(clip, 'genre_name'));
    setEventTitle(readClipString(clip, 'event_title'));
    setJambaseEventId(readClipNullableString(clip, 'jambase_event_id'));
    setJambaseArtistId(readClipNullableString(clip, 'jambase_artist_id'));
    setJambaseVenueId(readClipNullableString(clip, 'jambase_venue_id'));
    setArtistSearch(readClipString(clip, 'artist_name'));
    setVenueSearch(readClipString(clip, 'venue_name'));
    setArtistSuggestions([]);
    setVenueSuggestions([]);
    setShowArtistSuggestions(false);
    setShowVenueSuggestions(false);
    setError(null);
  }, [clip]);

  useEffect(() => {
    if (!asSuperadmin || debouncedArtistSearch.length < 2) {
      setArtistSuggestions([]);
      return;
    }
    let cancelled = false;
    setArtistSearchPending(true);
    void searchArtists(debouncedArtistSearch)
      .then((results) => {
        if (!cancelled) setArtistSuggestions(results);
      })
      .finally(() => {
        if (!cancelled) setArtistSearchPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asSuperadmin, debouncedArtistSearch, searchArtists]);

  useEffect(() => {
    if (!asSuperadmin || debouncedVenueSearch.length < 2) {
      setVenueSuggestions([]);
      return;
    }
    let cancelled = false;
    setVenueSearchPending(true);
    void searchVenues(debouncedVenueSearch, location || undefined)
      .then((results) => {
        if (!cancelled) setVenueSuggestions(results);
      })
      .finally(() => {
        if (!cancelled) setVenueSearchPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asSuperadmin, debouncedVenueSearch, location, searchVenues]);

  const currentFields = {
    artist_name: artistName,
    venue_name: venueName,
    location,
    content_description: description,
    hashtags,
    song_title: songTitle,
    genre_name: genreName,
    event_title: eventTitle,
    jambase_event_id: jambaseEventId,
    jambase_artist_id: jambaseArtistId,
    jambase_venue_id: jambaseVenueId,
  };

  const handleRecognitionSaved = (updated: ClipWithUser) => {
    setArtistName((updated.artist_name as string) ?? '');
    setVenueName((updated.venue_name as string) ?? '');
    setLocation((updated.location as string) ?? '');
    setDescription((updated.content_description as string) ?? '');
    setHashtags(hashtagsToInput(updated.hashtags));
    setSongTitle((updated.song_title as string) ?? '');
    setGenreName((updated.genre_name as string) ?? '');
    setEventTitle((updated.event_title as string) ?? '');
    setJambaseEventId(readClipNullableString(updated, 'jambase_event_id'));
    setJambaseArtistId(readClipNullableString(updated, 'jambase_artist_id'));
    setJambaseVenueId(readClipNullableString(updated, 'jambase_venue_id'));
    setArtistSearch((updated.artist_name as string) ?? '');
    setVenueSearch((updated.venue_name as string) ?? '');
    onSaved(updated);
  };

  const handleArtistSelect = (artist: JamBaseArtist) => {
    setArtistName(artist.name);
    setArtistSearch(artist.name);
    setJambaseArtistId(artist.identifier);
    setJambaseEventId(null);
    setArtistSuggestions([]);
    setShowArtistSuggestions(false);
  };

  const handleVenueSelect = (venue: JamBaseVenue) => {
    const venueLocation = venue.location?.city
      ? `${venue.location.city}, ${venue.location.state || venue.location.country || ''}`
      : '';
    setVenueName(venue.name);
    setVenueSearch(venue.name);
    if (venueLocation) setLocation(venueLocation);
    setJambaseVenueId(venue.identifier);
    setJambaseEventId(null);
    setVenueSuggestions([]);
    setShowVenueSuggestions(false);
  };

  const handleArtistSearchChange = (value: string) => {
    setArtistSearch(value);
    setArtistName(value.trim());
    setJambaseArtistId(null);
    setJambaseEventId(null);
    setShowArtistSuggestions(true);
  };

  const handleVenueSearchChange = (value: string) => {
    setVenueSearch(value);
    setVenueName(value.trim());
    setJambaseVenueId(null);
    setJambaseEventId(null);
    setShowVenueSuggestions(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clipId = clipNumericId(clip);
    const streamVideoId =
      typeof (clip as { stream_video_id?: unknown }).stream_video_id === 'string'
        ? String((clip as { stream_video_id: string }).stream_video_id).trim()
        : '';
    if (clipId == null && !streamVideoId) {
      setError('Invalid clip');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await saveClipMetadataFields(
        clip,
        {
          artist_name: artistName,
          venue_name: venueName,
          location,
          content_description: description,
          hashtags,
          song_title: songTitle,
          genre_name: genreName,
          ...(asSuperadmin
            ? {
                event_title: eventTitle,
                jambase_event_id: jambaseEventId,
                jambase_artist_id: jambaseArtistId,
                jambase_venue_id: jambaseVenueId,
              }
            : {}),
        },
        { asSuperadmin },
      );
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center glass-modal-overlay px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clip-edit-title"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl glass-dropdown">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 glass-chrome px-5 py-4">
          <h2 id="clip-edit-title" className="text-lg font-bold text-white">
            {asSuperadmin ? 'Edit clip (superadmin)' : 'Edit Clip Details'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          <p className="text-sm text-gray-400">
            {asSuperadmin
              ? 'Update metadata and JamBase show links for any clip. Video files are not changed here.'
              : 'Update how this moment appears in the feed. Video files are not changed here.'}
          </p>

          {asSuperadmin ? (
            <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
                Show
              </p>
              <div>
                <label htmlFor="edit-event-title" className="mb-1 block text-sm font-medium text-gray-300">
                  Event title
                </label>
                <input
                  id="edit-event-title"
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                  placeholder="Artist at Venue"
                  maxLength={300}
                />
              </div>
              <div>
                <label htmlFor="edit-jb-event" className="mb-1 block text-sm font-medium text-gray-300">
                  JamBase event ID <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  id="edit-jb-event"
                  type="text"
                  value={jambaseEventId ?? ''}
                  onChange={(e) => setJambaseEventId(e.target.value.trim() || null)}
                  className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none font-mono text-sm"
                  placeholder="jambase:123456"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="edit-artist" className="mb-1 block text-sm font-medium text-gray-300">
              Artist {asSuperadmin ? <span className="font-normal text-gray-500">(JamBase search)</span> : null}
            </label>
            {asSuperadmin ? (
              <div className="relative">
                <input
                  id="edit-artist"
                  type="text"
                  value={artistSearch}
                  onChange={(e) => handleArtistSearchChange(e.target.value)}
                  onFocus={() => setShowArtistSuggestions(true)}
                  autoComplete="off"
                  className="w-full rounded-lg glass-input rounded-xl px-3 py-2 pl-9 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                  placeholder="Search JamBase artists"
                  maxLength={200}
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-momentum-rose" />
                {showArtistSuggestions && debouncedArtistSearch.length >= 2 ? (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/15 bg-slate-900 shadow-xl">
                    {artistSearchPending ? (
                      <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
                    ) : artistSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No JamBase artists found</p>
                    ) : (
                      artistSuggestions.map((artist) => (
                        <button
                          key={artist.identifier}
                          type="button"
                          onClick={() => handleArtistSelect(artist)}
                          className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                        >
                          {artist.name}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                id="edit-artist"
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                placeholder="Artist name"
                maxLength={200}
              />
            )}
          </div>

          <div>
            <label htmlFor="edit-venue" className="mb-1 block text-sm font-medium text-gray-300">
              Venue {asSuperadmin ? <span className="font-normal text-gray-500">(JamBase search)</span> : null}
            </label>
            {asSuperadmin ? (
              <div className="relative">
                <input
                  id="edit-venue"
                  type="text"
                  value={venueSearch}
                  onChange={(e) => handleVenueSearchChange(e.target.value)}
                  onFocus={() => setShowVenueSuggestions(true)}
                  autoComplete="off"
                  className="w-full rounded-lg glass-input rounded-xl px-3 py-2 pl-9 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                  placeholder="Search JamBase venues"
                  maxLength={200}
                />
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-400" />
                {showVenueSuggestions && debouncedVenueSearch.length >= 2 ? (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/15 bg-slate-900 shadow-xl">
                    {venueSearchPending ? (
                      <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
                    ) : venueSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No JamBase venues found</p>
                    ) : (
                      venueSuggestions.map((venue) => (
                        <button
                          key={venue.identifier}
                          type="button"
                          onClick={() => handleVenueSelect(venue)}
                          className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                        >
                          <span className="block truncate">{venue.name}</span>
                          {venue.location?.city ? (
                            <span className="block text-xs text-gray-400 truncate">
                              {venue.location.city}
                              {venue.location.state ? `, ${venue.location.state}` : ''}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                id="edit-venue"
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
                placeholder="Venue name"
                maxLength={200}
              />
            )}
          </div>

          <div>
            <label htmlFor="edit-location" className="mb-1 block text-sm font-medium text-gray-300">
              Location
            </label>
            <input
              id="edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
              placeholder="City, state"
              maxLength={200}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="edit-song" className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Disc3 className="h-4 w-4 text-momentum-flare" aria-hidden />
                Song <span className="font-normal text-gray-500">(optional)</span>
              </label>
            </div>
            <input
              id="edit-song"
              type="text"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
              placeholder="What song was playing?"
              maxLength={200}
            />
            <ClipSongRecognitionControl
              className="mt-2"
              clip={clip}
              currentFields={currentFields}
              asSuperadmin={asSuperadmin}
              onSaved={handleRecognitionSaved}
            />
          </div>

          <div>
            <label htmlFor="edit-genre" className="mb-1 block text-sm font-medium text-gray-300">
              Genre <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <select
              id="edit-genre"
              value={genreName}
              onChange={(e) => setGenreName(e.target.value)}
              className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white focus:border-momentum-flare focus:outline-none"
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
          </div>

          <div>
            <label htmlFor="edit-desc" className="mb-1 block text-sm font-medium text-gray-300">
              Caption
            </label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
              placeholder="What was this moment?"
              maxLength={2000}
            />
          </div>

          <div>
            <label htmlFor="edit-tags" className="mb-1 block text-sm font-medium text-gray-300">
              Hashtags
            </label>
            <input
              id="edit-tags"
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full rounded-lg glass-input rounded-xl px-3 py-2 text-white placeholder:text-gray-500 focus:border-momentum-flare focus:outline-none"
              placeholder="livemusic, tour2025 (comma-separated)"
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-momentum-ember to-momentum-flare py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
