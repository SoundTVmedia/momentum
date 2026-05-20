import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import {
  artistFollowTarget,
  artistNameFollowKey,
  isArtistFollowTarget,
} from '@/react-app/lib/artist-follow-key'
import { artistFollowApiTarget } from '@/react-app/lib/artist-follow-key'

export type ToggleFollowOptions = {
  /** Required when following JamBase-only artists (`artist.id === 0`). */
  artistName?: string
}

/**
 * Follow hook — user follows use `follows`; artist follows use `user_favorite_artists`.
 */
export function useFollow() {
  const { user } = useAuth()
  const [following, setFollowing] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined' && user) {
      try {
        const stored = localStorage.getItem(`following_${user.id}`)
        return stored ? new Set(JSON.parse(stored)) : new Set()
      } catch {
        return new Set()
      }
    }
    return new Set()
  })
  const [loading, setLoading] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user && following.size > 0) {
      try {
        localStorage.setItem(`following_${user.id}`, JSON.stringify([...following]))
      } catch (err) {
        console.error('Failed to persist following:', err)
      }
    }
  }, [following, user])

  /** Keep artist follow buttons in sync with `user_favorite_artists`. */
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/users/me/favorite-artists', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          artists?: { artist_id?: unknown; name?: unknown }[]
        }
        const rows = Array.isArray(data.artists) ? data.artists : []
        const keys: string[] = []
        for (const a of rows) {
          const id =
            typeof a.artist_id === 'number' ? a.artist_id : Number(a.artist_id)
          if (Number.isFinite(id) && id > 0) keys.push(`artist-${id}`)
          if (typeof a.name === 'string' && a.name.trim()) {
            keys.push(artistNameFollowKey(a.name))
          }
        }
        if (keys.length === 0) return
        setFollowing((prev) => {
          const next = new Set(prev)
          for (const k of keys) next.add(k)
          return next
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const toggleFollow = useCallback(
    async (
      userId: string,
      options?: ToggleFollowOptions,
    ): Promise<{ success: boolean; following: boolean }> => {
      if (!user) {
        alert('Please sign in to follow')
        return { success: false, following: false }
      }

      if (loading.has(userId)) {
        return { success: false, following: following.has(userId) }
      }

      const artistName = options?.artistName?.trim()
      const artistKeys =
        isArtistFollowTarget(userId) && artistName
          ? [
              userId,
              artistNameFollowKey(artistName),
              artistFollowTarget(0, artistName),
            ]
          : [userId]
      const wasFollowing = artistKeys.some((k) => following.has(k))

      setFollowing((prev) => {
        const newSet = new Set(prev)
        for (const k of artistKeys) {
          if (wasFollowing) newSet.delete(k)
          else newSet.add(k)
        }
        return newSet
      })

      setLoading((prev) => {
        const next = new Set(prev)
        for (const k of artistKeys) next.add(k)
        return next
      })

      try {
        const apiTarget =
          isArtistFollowTarget(userId) && artistName
            ? artistFollowApiTarget(
                /^artist-(\d+)$/.exec(userId)?.[1]
                  ? Number(/^artist-(\d+)$/.exec(userId)![1])
                  : 0,
              )
            : userId

        const body: { artist_name?: string } = {}
        if (isArtistFollowTarget(userId) && artistName) {
          body.artist_name = artistName
        }

        const response = await fetch(`/api/users/${encodeURIComponent(apiTarget)}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
          throw new Error('Failed to follow')
        }

        const data = (await response.json()) as {
          following?: boolean
          artist_id?: number
        }
        const nowFollowing = data.following ?? !wasFollowing
        const resolvedArtistKey =
          typeof data.artist_id === 'number' && data.artist_id > 0
            ? `artist-${data.artist_id}`
            : null

        setFollowing((prev) => {
          const next = new Set(prev)
          for (const k of artistKeys) next.delete(k)
          if (nowFollowing) {
            next.add(resolvedArtistKey ?? artistFollowApiTarget(0))
            if (artistName) next.add(artistNameFollowKey(artistName))
          }
          return next
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          for (const k of artistKeys) newSet.delete(k)
          if (resolvedArtistKey) newSet.delete(resolvedArtistKey)
          return newSet
        })

        window.dispatchEvent(new CustomEvent('favorite-artists-changed'))

        return { success: true, following: nowFollowing }
      } catch (error) {
        console.error('Failed to follow:', error)

        setFollowing((prev) => {
          const newSet = new Set(prev)
          for (const k of artistKeys) {
            if (wasFollowing) newSet.add(k)
            else newSet.delete(k)
          }
          return newSet
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          for (const k of artistKeys) newSet.delete(k)
          return newSet
        })

        return { success: false, following: wasFollowing }
      }
    },
    [user, following, loading],
  )

  const toggleFollowArtist = useCallback(
    (artistId: number, artistName: string) => {
      return toggleFollow(artistFollowApiTarget(artistId), { artistName })
    },
    [toggleFollow],
  )

  const isFollowingArtist = useCallback(
    (artistId: number, artistName: string) => {
      if (artistId > 0 && following.has(`artist-${artistId}`)) return true
      return following.has(artistNameFollowKey(artistName))
    },
    [following],
  )

  const isArtistFollowLoading = useCallback(
    (artistId: number, artistName: string) => {
      if (artistId > 0 && loading.has(`artist-${artistId}`)) return true
      return loading.has(artistNameFollowKey(artistName))
    },
    [loading],
  )

  const isFollowing = useCallback(
    (userId: string) => following.has(userId),
    [following],
  )

  const isLoading = useCallback(
    (userId: string) => loading.has(userId),
    [loading],
  )

  return {
    toggleFollow,
    toggleFollowArtist,
    isFollowing,
    isFollowingArtist,
    isLoading,
    isArtistFollowLoading,
  }
}
