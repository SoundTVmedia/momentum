import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { apiFetch } from '@/react-app/lib/apiFetch'
import {
  artistFollowApiTarget,
  artistFollowStateKeys,
  isArtistFollowTarget,
  parseArtistIdFromFollowTarget,
} from '@/react-app/lib/artist-follow-key'
import { USER_BLOCKS_CHANGED_EVENT } from '@/react-app/lib/user-block-events'

export type ToggleFollowOptions = {
  /** Required when following JamBase-only artists (`artist.id === 0`). */
  artistName?: string
  /** Used to resolve JamBase-only venues when `venue.id === 0`. */
  venueName?: string
  venueJamBaseId?: string | null
}

export const FOLLOWING_CHANGED_EVENT = 'following-changed'

function dispatchFollowingChanged(): void {
  window.dispatchEvent(new CustomEvent(FOLLOWING_CHANGED_EVENT))
  window.dispatchEvent(new CustomEvent('favorite-artists-changed'))
}

/**
 * Follow hook — users and venues use `follows`; artists use `user_favorite_artists`.
 * Tap again while following to unfollow (same POST toggle endpoint).
 */
export function useFollow() {
  const { user } = useAuth()
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  const refreshFollowing = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch('/api/users/me/following', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { following_ids?: unknown }
      const ids = Array.isArray(data.following_ids)
        ? data.following_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
      setFollowing(new Set(ids))
      try {
        localStorage.setItem(`following_${user.id}`, JSON.stringify(ids))
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setFollowing(new Set())
      setHydrated(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await refreshFollowing()
      } catch {
        if (!cancelled) {
          try {
            const stored = localStorage.getItem(`following_${user.id}`)
            if (stored) {
              setFollowing(new Set(JSON.parse(stored) as string[]))
            }
          } catch {
            /* ignore */
          }
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, refreshFollowing])

  useEffect(() => {
    if (!user || !hydrated) return
    try {
      localStorage.setItem(`following_${user.id}`, JSON.stringify([...following]))
    } catch {
      /* ignore */
    }
  }, [following, user, hydrated])

  useEffect(() => {
    const onChanged = () => void refreshFollowing()
    window.addEventListener(FOLLOWING_CHANGED_EVENT, onChanged)
    window.addEventListener('favorite-artists-changed', onChanged)
    window.addEventListener(USER_BLOCKS_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(FOLLOWING_CHANGED_EVENT, onChanged)
      window.removeEventListener('favorite-artists-changed', onChanged)
      window.removeEventListener(USER_BLOCKS_CHANGED_EVENT, onChanged)
    }
  }, [refreshFollowing])

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
      const stateKeys = isArtistFollowTarget(userId)
        ? artistFollowStateKeys(parseArtistIdFromFollowTarget(userId), artistName)
        : [userId]
      const wasFollowing = stateKeys.some((k) => following.has(k))

      setFollowing((prev) => {
        const newSet = new Set(prev)
        for (const k of stateKeys) {
          if (wasFollowing) newSet.delete(k)
          else newSet.add(k)
        }
        return newSet
      })

      setLoading((prev) => {
        const next = new Set(prev)
        for (const k of stateKeys) next.add(k)
        return next
      })

      try {
        const apiTarget = isArtistFollowTarget(userId)
          ? artistFollowApiTarget(parseArtistIdFromFollowTarget(userId))
          : userId

        const body: { artist_name?: string; venue_name?: string; jambase_id?: string } = {}
        if (isArtistFollowTarget(userId) && artistName) {
          body.artist_name = artistName
        }
        if (userId.startsWith('venue-') && options?.venueName?.trim()) {
          body.venue_name = options.venueName.trim()
          if (options.venueJamBaseId?.trim()) {
            body.jambase_id = options.venueJamBaseId.trim()
          }
        }

        const response = await apiFetch(
          `/api/users/${encodeURIComponent(apiTarget)}/follow`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
          },
        )

        if (!response.ok) {
          throw new Error(wasFollowing ? 'Failed to unfollow' : 'Failed to follow')
        }

        const data = (await response.json()) as {
          following?: boolean
          artist_id?: number
          venue_id?: number
        }
        const nowFollowing = data.following ?? !wasFollowing

        setFollowing((prev) => {
          const next = new Set(prev)
          for (const k of stateKeys) next.delete(k)
          if (nowFollowing) {
            if (isArtistFollowTarget(userId)) {
              const resolvedId =
                typeof data.artist_id === 'number' && data.artist_id > 0
                  ? data.artist_id
                  : parseArtistIdFromFollowTarget(userId)
              for (const k of artistFollowStateKeys(resolvedId, artistName)) {
                next.add(k)
              }
            } else if (userId.startsWith('venue-')) {
              const resolvedId =
                typeof data.venue_id === 'number' && data.venue_id > 0
                  ? data.venue_id
                  : Number(userId.slice('venue-'.length))
              if (Number.isInteger(resolvedId) && resolvedId > 0) {
                next.add(`venue-${resolvedId}`)
              }
            } else {
              next.add(userId)
            }
          }
          return next
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          for (const k of stateKeys) newSet.delete(k)
          return newSet
        })

        dispatchFollowingChanged()

        return { success: true, following: nowFollowing }
      } catch (error) {
        console.error('Failed to toggle follow:', error)

        setFollowing((prev) => {
          const newSet = new Set(prev)
          for (const k of stateKeys) {
            if (wasFollowing) newSet.add(k)
            else newSet.delete(k)
          }
          return newSet
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          for (const k of stateKeys) newSet.delete(k)
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

  const toggleFollowVenue = useCallback(
    (venueId: number, venueName?: string, venueJamBaseId?: string | null) => {
      return toggleFollow(`venue-${venueId > 0 ? venueId : 0}`, { venueName, venueJamBaseId })
    },
    [toggleFollow],
  )

  const isFollowingArtist = useCallback(
    (artistId: number, artistName: string) => {
      return artistFollowStateKeys(artistId, artistName).some((k) => following.has(k))
    },
    [following],
  )

  const isArtistFollowLoading = useCallback(
    (artistId: number, artistName: string) => {
      return artistFollowStateKeys(artistId, artistName).some((k) => loading.has(k))
    },
    [loading],
  )

  const isFollowingVenue = useCallback(
    (venueId: number) => following.has(`venue-${venueId}`),
    [following],
  )

  const isVenueFollowLoading = useCallback(
    (venueId: number) => loading.has(`venue-${venueId}`),
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
    toggleFollowVenue,
    isFollowing,
    isFollowingArtist,
    isFollowingVenue,
    isLoading,
    isArtistFollowLoading,
    isVenueFollowLoading,
    hydrated,
    refreshFollowing,
  }
}
