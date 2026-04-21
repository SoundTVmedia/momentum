import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@getmocha/users-service/react'

/**
 * Enhanced clip like hook with local storage persistence for better UX
 */
export function useClipLike() {
  const { user } = useAuth()
  const [likedClips, setLikedClips] = useState<Set<number>>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined' && user) {
      try {
        const stored = localStorage.getItem(`liked_clips_${user.id}`)
        return stored ? new Set(JSON.parse(stored)) : new Set()
      } catch {
        return new Set()
      }
    }
    return new Set()
  })
  const [loading, setLoading] = useState<Set<number>>(new Set())

  // Persist liked clips to localStorage
  useEffect(() => {
    if (user && likedClips.size > 0) {
      try {
        localStorage.setItem(`liked_clips_${user.id}`, JSON.stringify([...likedClips]))
      } catch (err) {
        console.error('Failed to persist liked clips:', err)
      }
    }
  }, [likedClips, user])

  const toggleLike = useCallback(
    async (clipId: number, currentLikesCount: number): Promise<{ success: boolean; newCount: number }> => {
      if (!user) {
        alert('Please sign in to like clips')
        return { success: false, newCount: currentLikesCount }
      }

      if (loading.has(clipId)) {
        return { success: false, newCount: currentLikesCount }
      }

      const wasLiked = likedClips.has(clipId)
      const newCount = currentLikesCount + (wasLiked ? -1 : 1)

      // Optimistic update
      setLikedClips((prev) => {
        const newSet = new Set(prev)
        if (wasLiked) {
          newSet.delete(clipId)
        } else {
          newSet.add(clipId)
        }
        return newSet
      })

      setLoading((prev) => new Set(prev).add(clipId))

      try {
        const response = await fetch(`/api/clips/${clipId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to like clip')
        }

        setLoading((prev) => {
          const newSet = new Set(prev)
          newSet.delete(clipId)
          return newSet
        })

        return { success: true, newCount }
      } catch (error) {
        console.error('Failed to like clip:', error)

        // Revert on error
        setLikedClips((prev) => {
          const newSet = new Set(prev)
          if (wasLiked) {
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

        return { success: false, newCount: currentLikesCount }
      }
    },
    [user, likedClips, loading]
  )

  const isLiked = useCallback(
    (clipId: number) => likedClips.has(clipId),
    [likedClips]
  )

  const isLoading = useCallback(
    (clipId: number) => loading.has(clipId),
    [loading]
  )

  return {
    toggleLike,
    isLiked,
    isLoading,
  }
}
