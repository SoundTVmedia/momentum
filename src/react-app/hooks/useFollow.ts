import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@getmocha/users-service/react'

/**
 * Enhanced follow hook with local storage persistence for better UX
 */
export function useFollow() {
  const { user } = useAuth()
  const [following, setFollowing] = useState<Set<string>>(() => {
    // Initialize from localStorage if available
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

  // Persist following to localStorage
  useEffect(() => {
    if (user && following.size > 0) {
      try {
        localStorage.setItem(`following_${user.id}`, JSON.stringify([...following]))
      } catch (err) {
        console.error('Failed to persist following:', err)
      }
    }
  }, [following, user])

  const toggleFollow = useCallback(
    async (userId: string): Promise<{ success: boolean; following: boolean }> => {
      if (!user) {
        alert('Please sign in to follow users')
        return { success: false, following: false }
      }

      if (loading.has(userId)) {
        return { success: false, following: following.has(userId) }
      }

      const wasFollowing = following.has(userId)

      // Optimistic update
      setFollowing((prev) => {
        const newSet = new Set(prev)
        if (wasFollowing) {
          newSet.delete(userId)
        } else {
          newSet.add(userId)
        }
        return newSet
      })

      setLoading((prev) => new Set(prev).add(userId))

      try {
        const response = await fetch(`/api/users/${userId}/follow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to follow user')
        }

        const data = await response.json()

        setLoading((prev) => {
          const newSet = new Set(prev)
          newSet.delete(userId)
          return newSet
        })

        return { success: true, following: data.following }
      } catch (error) {
        console.error('Failed to follow user:', error)

        // Revert on error
        setFollowing((prev) => {
          const newSet = new Set(prev)
          if (wasFollowing) {
            newSet.add(userId)
          } else {
            newSet.delete(userId)
          }
          return newSet
        })

        setLoading((prev) => {
          const newSet = new Set(prev)
          newSet.delete(userId)
          return newSet
        })

        return { success: false, following: wasFollowing }
      }
    },
    [user, following, loading]
  )

  const isFollowing = useCallback(
    (userId: string) => following.has(userId),
    [following]
  )

  const isLoading = useCallback(
    (userId: string) => loading.has(userId),
    [loading]
  )

  return {
    toggleFollow,
    isFollowing,
    isLoading,
  }
}
