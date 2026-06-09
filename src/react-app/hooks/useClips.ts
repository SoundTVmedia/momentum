import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClipWithUser } from '@/shared/types'
import { apiFetch } from '@/react-app/lib/apiFetch'

interface UseClipsOptions {
  feedType?: 'latest' | 'trending' | 'most_liked' | 'most_viewed'
  /** `main` = public performance feed (default); `pre_post` = friends-only talking moments. */
  feedScope?: 'main' | 'pre_post'
  artistName?: string
  venueName?: string
  songSlug?: string
  genreSlug?: string
  userId?: string
  /** When true, uses GET /api/me/clips (session user) so list ids always match delete/update. */
  mine?: boolean
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
    async (pageNum: number, append: boolean = false) => {
      const generation = ++fetchGenerationRef.current

      if (append) {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
      } else {
        setClips([])
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

        const listPath =
          feedScope === 'pre_post' && !mine
            ? `/api/clips/friends-prepost?${params}`
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

        if (append) {
          setClips((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const newClips = (data.clips ?? []).filter((c) => !existingIds.has(c.id))
            return [...prev, ...newClips]
          })
        } else {
          setClips(data.clips ?? [])
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
    [feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, limit],
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
  }, [feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, limit, fetchClips])

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

        const listPath =
          feedScope === 'pre_post' && !mine
            ? `/api/clips/friends-prepost?${params}`
            : mine
              ? `/api/me/clips?${params}`
              : `/api/clips?${params}`
        const response = await apiFetch(listPath, {
          cache: 'no-store',
        })

        if (!response.ok) return

        const data = (await response.json()) as { clips?: ClipWithUser[] }

        if (data.clips && data.clips.length > 0) {
          setClips((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const fresh = data.clips!.filter((c) => !existingIds.has(c.id))
            return fresh.length > 0 ? [...fresh, ...prev] : prev
          })
        }
      } catch (err) {
        console.error('Failed to poll for new clips:', err)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [enablePolling, feedType, feedScope, artistName, venueName, songSlug, genreSlug, userId, mine, clips, limit])

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
