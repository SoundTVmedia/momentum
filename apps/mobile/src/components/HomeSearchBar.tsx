import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchAdvancedSearch } from '@/src/lib/api/clips';
import type { ClipFeedItem } from '@/src/lib/api/types';
import { artistPath, venuePath } from '@shared/app-paths';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type Props = {
  onSelectClip?: (clip: ClipFeedItem, feed: ClipFeedItem[]) => void;
};

export function HomeSearchBar({ onSelectClip }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Awaited<
    ReturnType<typeof fetchAdvancedSearch>
  > | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setOpen(true);
      void fetchAdvancedSearch(trimmed, {
        compact: true,
        signal: controller.signal,
      })
        .then((data) => {
          setResults(data);
        })
        .catch((err) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setResults(null);
        })
        .finally(() => setLoading(false));
    }, 280);
  };

  const goDiscover = () => {
    const q = query.trim();
    setOpen(false);
    if (q) {
      router.push(`/discover?q=${encodeURIComponent(q)}`);
    } else {
      router.push('/discover');
    }
  };

  const clips = results?.clips ?? [];
  const artists = results?.artists ?? [];
  const venues = results?.venues ?? [];
  const hasHits =
    clips.length > 0 || artists.length > 0 || venues.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            runSearch(value);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search artists, venues, songs, clips…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={goDiscover}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable style={styles.searchBtn} onPress={goDiscover}>
          <Text style={styles.searchBtnLabel}>Search</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.dropdown}>
          {loading && !results ? (
            <ActivityIndicator color={colors.ember} style={styles.loader} />
          ) : null}
          {!loading && results && !hasHits ? (
            <Text style={styles.empty}>No matches for “{query.trim()}”</Text>
          ) : null}

          {clips.slice(0, 4).map((clip) => (
            <Pressable
              key={`clip-${clip.id}`}
              style={styles.row}
              onPress={() => {
                setOpen(false);
                onSelectClip?.(clip, clips);
              }}
            >
              <Text style={styles.rowKind}>Clip</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {clip.song_title || clip.artist_name || 'Untitled clip'}
              </Text>
            </Pressable>
          ))}

          {artists.slice(0, 4).map((artist) => (
            <Pressable
              key={`artist-${artist.name}`}
              style={styles.row}
              onPress={() => {
                setOpen(false);
                router.push(artistPath(artist.name) as `/artists/${string}`);
              }}
            >
              <Text style={styles.rowKind}>Artist</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {artist.name}
              </Text>
            </Pressable>
          ))}

          {venues.slice(0, 4).map((venue) => (
            <Pressable
              key={`venue-${venue.name}`}
              style={styles.row}
              onPress={() => {
                setOpen(false);
                router.push(venuePath(venue.name) as `/venues/${string}`);
              }}
            >
              <Text style={styles.rowKind}>Venue</Text>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {venue.name}
                {venue.location ? ` · ${venue.location}` : ''}
              </Text>
            </Pressable>
          ))}

          {hasHits || query.trim().length >= 2 ? (
            <Pressable style={styles.seeAll} onPress={goDiscover}>
              <Text style={styles.seeAllLabel}>See all on Discover</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 20,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.glassBgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderAccent,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.textBody,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  searchBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.flare,
  },
  searchBtnLabel: {
    color: colors.textBody,
    fontWeight: '700',
    fontSize: 13,
  },
  dropdown: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.shellBgMid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  empty: {
    ...typography.caption,
    padding: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.shellBorder,
    gap: 2,
  },
  rowKind: {
    ...typography.label,
    fontSize: 10,
  },
  rowTitle: {
    color: colors.textBody,
    fontSize: 14,
    fontWeight: '600',
  },
  seeAll: {
    padding: spacing.md,
    alignItems: 'center',
  },
  seeAllLabel: {
    color: colors.ember,
    fontWeight: '600',
    fontSize: 13,
  },
});
