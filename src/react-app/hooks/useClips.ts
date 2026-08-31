import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClipWithUser } from '@/shared/types'
import { apiFetch } from '@/react-app/lib/apiFetch'
import { clipNumericId } from '@/react-app/lib/clip-numeric-id'
import {
  CLIP_PLAYBACK_SKIPPED_EVENT,
  clipPlaybackSkippedDetail,
  filterViewerFeedClips,
} from '@/react-app/lib/clipPlaybackFailure'
import {
  USER_BLOCKS_CHANGED_EVENT,
  userBlocksChangedDetail,
} from '@/react-app/lib/user-block-events'
import { FOLLOWING_CHANGED_EVENT } from '@/react-app/hooks/useFollow'

interface UseClipsOptions {
  feedType?: 'latest' | 'most_liked' | 'most_viewed'
  /** `main` = public performance feed (default); `friends` = clips from people you follow. */
  feedScope?: 'main' | 'friends'
  artistName?: string
  venueName?: string
  songSlug?: string
  genreSlug?: string
  userId?: string
  /** When true, uses GET /api/me/clips (session user) so list ids always match delete/update. */
  mine?: boolean
  /** Filter own clips by lane (`/api/me/clips?content_feed=`). */
  contentFeed?: 'main' | 'pre_post'
  limit?: number
  enablePolling?: boolean
}

export function useClips(options: UseClipsOptions = {}) {
  const {
    feedType = 'latest',
    feedScope = 'main',
    artistName,
    venueName,
    songSlug,
    genreSlug,
    userId,
    mine = false,
    contentFeed,
    limit = 10,
    enablePolling = false,
  } = options

  const [clips, setClips] = useState<ClipWithUser[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGenerationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  const fetchClips = useCallback(
    async (pageNum: number, append: boolean = false, preserveExisting: boolean = false) => {
      const generation = ++fetchGenerationRef.current

      if (append) {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
      } else {
        if (!preserveExisting) setClips([])
        setHasMore(true)
        setError(null)
      }

      setLoading(true)

      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: limit.toString(),
          sort_by: feedType,
        })

        if (artistName) params.append('artist_name', artistName)
        if (venueName) params.append('venue_name', venueName)
        if (songSlug) params.append('song_slug', songSlug)
        if (genreSlug) params.append('genre_slug', genreSlug)
        if (!mine && userId) params.append('user_id', userId)
        if (mine && contentFeed) params.append('content_feed', contentFeed)

        const listPath =
          feedScope === 'friends' && !mine
            ? `/api/clips/friends?${params}`
            : mine
              ? `/api/me/clips?${params}`
              : `/api/clips?${params}`
        const response = await apiFetch(listPath, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (generation !== fetchGenerationRef.current) return

        if (!response.ok) {
          throw new Error('Failed to fetch clips')
        }

        const data = (await response.json()) as {
          clips?: ClipWithUser[]
          hasMore?: boolean
        }

        if (generation !== fetchGenerationRef.current) return

        const incoming = data.clips ?? []
        const nextClips = mine ? incoming : filterViewerFeedClips(incoming)

        if (append) {
          setClips((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const newClips = nextClips.filter((c) => !existingIds.has(c.id))
            return [...prev, ...newClips]
          })
        } else {
          setClips(nextClips)
        }

        setHasMore(Boolean(data.hasMore))
      } catch (err) {
        if (generation !== fetchGenerationRef.current) return
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch clips:', err)
        if (!append) {
          setClips([])
          setHasMore(false)
        }
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false)
        }
        if (append) {
          loadingMoreRef.current = false
        }
      }
    },
    [feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, contentFeed, limit],
  )

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMoreRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    void fetchClips(nextPage, true)
  }, [page, hasMore, loading, fetchClips])

  const refresh = useCallback(() => {
    setPage(1)
    void fetchClips(1, false)
  }, [fetchClips])

  const removeClip = useCallback((clipId: number) => {
    setClips((prev) =>
      prev.filter((c) => {
        const id = typeof c.id === 'number' ? c.id : Number(c.id)
        return !Number.isFinite(id) || id !== clipId
      }),
    )
  }, [])

  const removeClipBy = useCallback((predicate: (clip: ClipWithUser) => boolean) => {
    setClips((prev) => prev.filter((c) => !predicate(c)))
  }, [])

  const updateClip = useCallback((updated: ClipWithUser) => {
    const uid = typeof updated.id === 'number' ? updated.id : Number(updated.id)
    if (!Number.isFinite(uid)) return
    setClips((prev) =>
      prev.map((c) => {
        const id = typeof c.id === 'number' ? c.id : Number(c.id)
        return Number.isFinite(id) && id === uid ? ({ ...c, ...updated } as ClipWithUser) : c
      }),
    )
  }, [])

  useEffect(() => {
    setPage(1)
    void fetchClips(1, false)
  }, [feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, contentFeed, limit, fetchClips])

  useEffect(() => {
    if (mine) return

    const onBlocksChanged = (event: Event) => {
      const detail = userBlocksChangedDetail(event)
      if (!detail) return

      if (detail.blocked) {
        setClips((prev) =>
          prev.filter(
            (clip) => String(clip.mocha_user_id ?? '').trim().toLowerCase() !== detail.userId,
          ),
        )
        setPage(1)
        void fetchClips(1, false, true)
        return
      }

      setPage(1)
      void fetchClips(1, false)
    }

    window.addEventListener(USER_BLOCKS_CHANGED_EVENT, onBlocksChanged)
    return () => window.removeEventListener(USER_BLOCKS_CHANGED_EVENT, onBlocksChanged)
  }, [fetchClips, mine])

  useEffect(() => {
    if (feedScope !== 'friends' || mine) return
    const onFollowingChanged = () => {
      setPage(1)
      void fetchClips(1, false)
    }
    window.addEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged)
    window.addEventListener('favorite-artists-changed', onFollowingChanged)
    return () => {
      window.removeEventListener(FOLLOWING_CHANGED_EVENT, onFollowingChanged)
      window.removeEventListener('favorite-artists-changed', onFollowingChanged)
    }
  }, [feedScope, mine, fetchClips])

  useEffect(() => {
    const onSkipped = (event: Event) => {
      const detail = clipPlaybackSkippedDetail(event)
      if (!detail) return
      setClips((prev) => {
        if (mine) {
          if (!detail.hidden) return prev
          return prev.map((clip) =>
            clipNumericId(clip) === detail.clipId
              ? { ...clip, playback_unplayable: 1 }
              : clip,
          )
        }
        return prev.filter((clip) => clipNumericId(clip) !== detail.clipId)
      })
    }
    window.addEventListener(CLIP_PLAYBACK_SKIPPED_EVENT, onSkipped)
    return () => window.removeEventListener(CLIP_PLAYBACK_SKIPPED_EVENT, onSkipped)
  }, [mine])

  useEffect(() => {
    if (!enablePolling || feedType !== 'latest' || clips.length === 0) return

    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          sort_by: feedType,
          since: clips[0]?.created_at || new Date().toISOString(),
        })

        if (artistName) params.append('artist_name', artistName)
        if (venueName) params.append('venue_name', venueName)
        if (songSlug) params.append('song_slug', songSlug)
        if (genreSlug) params.append('genre_slug', genreSlug)
        if (!mine && userId) params.append('user_id', userId)
        if (mine && contentFeed) params.append('content_feed', contentFeed)

        const listPath =
          feedScope === 'friends' && !mine
            ? `/api/clips/friends?${params}`
            : mine
              ? `/api/me/clips?${params}`
              : `/api/clips?${params}`
        const response = await apiFetch(listPath, {
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = (await response.json()) as { clips?: ClipWithUser[] }

        if (data.clips && data.clips.length > 0) {
          const incoming = mine ? data.clips : filterViewerFeedClips(data.clips)
          setClips((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const fresh = incoming.filter((c) => !existingIds.has(c.id))
            return fresh.length > 0 ? [...fresh, ...prev] : prev
          })
        }
      } catch (err) {
        console.error('Failed to poll for new clips:', err)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [enablePolling, feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, contentFeed, clips, limit])

  return {
    clips,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    refetch: refresh,
    removeClip,
    removeClipBy,
    updateClip,
  }
}
