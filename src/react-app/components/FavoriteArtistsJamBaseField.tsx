import { useState, useEffect, useCallback, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useDebounce } from '@/react-app/hooks/useDebounce';
import { useJamBase } from '@/react-app/hooks/useJamBase';
import type { JamBaseArtist } from '@/shared/types';

export const DEFAULT_POPULAR_ARTISTS = [
  'Taylor Swift',
  'The Weeknd',
  'Drake',
  'Billie Eilish',
  'Bad Bunny',
  'Ed Sheeran',
  'Ariana Grande',
  'Beyoncé',
  'Post Malone',
  'Olivia Rodrigo',
  'Travis Scott',
  'Dua Lipa',
  'Harry Styles',
  'SZA',
  'Morgan Wallen',
  'Luke Combs',
  'Peso Pluma',
  'Karol G',
  'Future',
  '21 Savage',
] as const;

type Props = {
  favoriteArtists: string[];
  setFavoriteArtists: Dispatch<SetStateAction<string[]>>;
  /** Extra line after “Favorite Artists” (e.g. hint text). */
  labelExtra?: ReactNode;
  /** Optional override for quick-pick chips (defaults to {@link DEFAULT_POPULAR_ARTISTS}). */
  popularArtists?: readonly string[];
};

export default function FavoriteArtistsJamBaseField({
  favoriteArtists,
  setFavoriteArtists,
  labelExtra,
  popularArtists = DEFAULT_POPULAR_ARTISTS,
}: Props) {
  const [artistSearch, setArtistSearch] = useState('');
  const debouncedSearch = useDebounce(artistSearch.trim(), 350);
  const { searchArtists, loading: jambaseLoading } = useJamBase();
  const [jambaseSuggestions, setJambaseSuggestions] = useState<JamBaseArtist[]>([]);

  const removeArtist = useCallback(
    (name: string) => {
      setFavoriteArtists((prev) => prev.filter((a) => a !== name));
    },
    [setFavoriteArtists],
  );

  const addArtistName = useCallback(
    (name: string) => {
      const t = name.trim();
      if (!t) return;
      setFavoriteArtists((prev) => (prev.includes(t) ? prev : [...prev, t]));
      setArtistSearch('');
      setJambaseSuggestions([]);
    },
    [setFavoriteArtists],
  );

  const addCustomArtist = () => {
    addArtistName(artistSearch);
  };

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setJambaseSuggestions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await searchArtists(debouncedSearch);
      if (!cancelled) setJambaseSuggestions(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, searchArtists]);

  const filteredPopular = popularArtists.filter(
    (artist) =>
      artist.toLowerCase().includes(artistSearch.toLowerCase()) && !favoriteArtists.includes(artist),
  );

  const showJamBaseDropdown = artistSearch.trim().length >= 2;

  return (
    <div>
      <label className="block text-white font-medium mb-4">
        Favorite Artists
        {labelExtra}
      </label>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-[1]" />
          <input
            type="text"
            value={artistSearch}
            onChange={(e) => setArtistSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomArtist();
              }
            }}
            autoComplete="off"
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-mint"
            placeholder="Search JamBase artists or type a name…"
          />

          {showJamBaseDropdown && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-white/20 bg-black/95 shadow-xl backdrop-blur-md">
              {jambaseLoading && jambaseSuggestions.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Searching JamBase…
                </div>
              ) : jambaseSuggestions.length === 0 ? (
                <div className="px-3 py-3 text-gray-400 text-sm">
                  No JamBase matches — press Enter to add &quot;{artistSearch.trim()}&quot; anyway.
                </div>
              ) : (
                <ul className="py-1">
                  {jambaseSuggestions.map((a) => {
                    const taken = favoriteArtists.includes(a.name);
                    return (
                      <li key={a.identifier}>
                        <button
                          type="button"
                          disabled={taken}
                          onClick={() => addArtistName(a.name)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {a.image ? (
                            <img src={a.image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-md bg-white/10" />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                          {taken ? (
                            <span className="shrink-0 text-[10px] uppercase text-gray-500">Added</span>
                          ) : (
                            <span className="shrink-0 text-[10px] uppercase text-cyan-400/90">JamBase</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Results from JamBase; you can still add any name with Enter if it does not appear.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {favoriteArtists.map((artist) => (
          <button
            key={artist}
            type="button"
            onClick={() => removeArtist(artist)}
            className="px-4 py-2 momentum-grad-interactive rounded-full text-white text-sm font-medium hover:scale-105 transition-transform"
          >
            {artist} ×
          </button>
        ))}
      </div>

      <p className="text-gray-500 text-xs mb-2">Quick picks</p>
      <div className="flex flex-wrap gap-2">
        {filteredPopular.map((artist) => (
          <button
            key={artist}
            type="button"
            onClick={() => addArtistName(artist)}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-gray-300 text-sm font-medium hover:bg-white/20 transition-all"
          >
            {artist}
          </button>
        ))}
      </div>
    </div>
  );
}
