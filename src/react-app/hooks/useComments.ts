import { useState, useEffect, useCallback } from 'react'

interface Comment {
  id: number
  clip_id: number
  mocha_user_id: string
  parent_comment_id: number | null
  content: string
  created_at: string
  updated_at: string
  user_display_name: string | null
  user_avatar: string | null
}

export function useComments(clipId: number) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/clips/${clipId}/comments`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch comments')
      }

      const data = await response.json()
      setComments(data.comments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Failed to fetch comments:', err)
    } finally {
      setLoading(false)
    }
  }, [clipId])

  const postComment = useCallback(
    async (content: string, parentCommentId?: number): Promise<boolean> => {
      try {
        const response = await fetch(`/api/clips/${clipId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content,
            parent_comment_id: parentCommentId || null,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to post comment')
        }

        const newComment = await response.json()
        setComments((prev) => [newComment, ...prev])
        return true
      } catch (err) {
        console.error('Failed to post comment:', err)
        return false
      }
    },
    [clipId]
  )

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  return {
    comments,
    loading,
    error,
    postComment,
    refresh: fetchComments,
  }
}
