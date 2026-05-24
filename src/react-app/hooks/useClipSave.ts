import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { notifySavedClipsChanged } from '@/react-app/lib/savedClipsEvents'

/**
 * Enhanced clip save hook with local storage persistence for better UX
 */
export function useClipSave() {
  const { user } = useAuth()
  const [savedClips, setSavedClips] = useState<Set<number>>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined' && user) {
      try {
        const stored = localStorage.getItem(`saved_clips_${user.id}`)
        return stored ? new Set(JSON.parse(stored)) : new Set()
      } catch {
        return new Set()
      }
    }
    return new Set()
  })
  const [loading, setLoading] = useState<Set<number>>(new Set())

  // Merge server-side saved ids on sign-in (bookmark UI stays in sync across devices)
  useEffect(() => {
    if (!user) {
      setSavedClips(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/users/me/saved-clip-ids', { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { clip_ids?: unknown }
        const ids = Array.isArray(data.clip_ids)
          ? data.clip_ids.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
          : []
        if (cancelled) return
        setSavedClips(new Set(ids))
      } catch {
        /* keep local cache */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Persist saved clips to localStorage
  useEffect(() => {
    if (user && savedClips.size > 0) {
      try {
        localStorage.setItem(`saved_clips_${user.id}`, JSON.stringify([...savedClips]))
      } catch (err) {
        console.error('Failed to persist saved clips:', err)
      }
    }
  }, [savedClips, user])

  const toggleSave = useCallback(
    async (clipId: number): Promise<{ success: boolean; saved: boolean }> => {
      if (!user) {
        alert('Please sign in to save clips')
        return { success: false, saved: false }
      }

      if (loading.has(clipId)) {
        return { success: false, saved: savedClips.has(clipId) }
      }

      const wasSaved = savedClips.has(clipId)

      // Optimistic update
      setSavedClips((prev) => {
        const newSet = new Set(prev)
        if (wasSaved) {
          newSet.delete(clipId)
        } else {
          newSet.add(clipId)
        }
        return newSet
      })

      setLoading((prev) => new Set(prev).add(clipId))

      try {
        const response = await fetch(`/api/clips/${clipId}/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to save clip')
        }

        const data = await response.json()

        setLoading((prev) => {
          const newSet = new Set(prev)
          newSet.delete(clipId)
          return newSet
        })

        setSavedClips((prev) => {
          const next = new Set(prev)
          if (data.saved) next.add(clipId)
          else next.delete(clipId)
          return next
        })
        notifySavedClipsChanged()

        return { success: true, saved: data.saved }
      } catch (error) {
        console.error('Failed to save clip:', error)

        // Revert on error
        setSavedClips((prev) => {
          const newSet = new Set(prev)
          if (wasSaved) {
            newSet.add(clipId)
          } else {
            newSet.delete(clipId)
          }
          return newSet
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          newSet.delete(clipId)
          return newSet
        })

        return { success: false, saved: wasSaved }
      }
    },
    [user, savedClips, loading]
  )

  const isSaved = useCallback(
    (clipId: number) => savedClips.has(clipId),
    [savedClips]
  )

  const isLoading = useCallback(
    (clipId: number) => loading.has(clipId),
    [loading]
  )

  return {
    toggleSave,
    isSaved,
    isLoading,
  }
}
