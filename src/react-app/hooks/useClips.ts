import { useState, useEffect, useCallback } from 'react'
import type { ClipWithUser } from '@/shared/types'

interface UseClipsOptions {
  feedType?: 'latest' | 'trending' | 'most_liked' | 'most_viewed' | 'top_rated'
  artistName?: string
  venueName?: string
  userId?: string
  limit?: number
  enablePolling?: boolean
}

export function useClips(options: UseClipsOptions = {}) {
  const {
    feedType = 'latest',
    artistName,
    venueName,
    userId,
    limit = 10,
    enablePolling = false,
  } = options

  const [clips, setClips] = useState<ClipWithUser[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClips = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (loading) return

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: limit.toString(),
          sort_by: feedType,
        })

        if (artistName) params.append('artist_name', artistName)
        if (venueName) params.append('venue_name', venueName)
        if (userId) params.append('user_id', userId)

        const response = await fetch(`/api/clips?${params}`, {
          // Add cache headers for better performance
          headers: {
            'Cache-Control': 'public, max-age=60',
          },
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch clips')
        }

        const data = await response.json()

        if (append) {
          // Use functional update to prevent duplicates
          setClips((prev) => {
            const existingIds = new Set(prev.map(c => c.id))
            const newClips = (data.clips || []).filter((c: any) => !existingIds.has(c.id))
            return [...prev, ...newClips]
          })
        } else {
          setClips(data.clips || [])
        }

        setHasMore(data.hasMore || false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch clips:', err)
      } finally {
        setLoading(false)
      }
    },
    [feedType, artistName, venueName, userId, limit, loading]
  )

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchClips(nextPage, true)
  }, [page, hasMore, loading, fetchClips])

  const refresh = useCallback(() => {
    setPage(1)
    fetchClips(1, false)
  }, [fetchClips])

  const removeClip = useCallback((clipId: number) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId))
  }, [])

  // Initial load
  useEffect(() => {
    setPage(1)
    fetchClips(1, false)
  }, [feedType, artistName, venueName, userId, limit])

  // Polling for new clips
  useEffect(() => {
    if (!enablePolling || clips.length === 0) return

    const interval = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          sort_by: feedType,
          since: clips[0]?.created_at || new Date().toISOString(),
        })

        if (artistName) params.append('artist_name', artistName)
        if (venueName) params.append('venue_name', venueName)
        if (userId) params.append('user_id', userId)

        const response = await fetch(`/api/clips?${params}`)
        
        if (!response.ok) return

        const data = await response.json()

        if (data.clips && data.clips.length > 0) {
          setClips((prev) => [...data.clips, ...prev])
        }
      } catch (err) {
        console.error('Failed to poll for new clips:', err)
      }
    }, 15000) // Poll every 15 seconds

    return () => clearInterval(interval)
  }, [enablePolling, feedType, artistName, venueName, userId, clips, limit])

  return {
    clips,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    refetch: refresh, // Alias for clarity in error handling
    removeClip,
  }
}
