import { useState, useEffect, useCallback } from 'react'

export interface Comment {
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

function parseComment(row: unknown, clipId: number): Comment | null {
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const id = Number(o.id)
  if (!Number.isFinite(id)) return null
  return {
    id,
    clip_id: Number(o.clip_id) || clipId,
    mocha_user_id: String(o.mocha_user_id ?? ''),
    parent_comment_id:
      o.parent_comment_id == null ? null : Number(o.parent_comment_id) || null,
    content: String(o.content ?? ''),
    created_at: String(o.created_at ?? new Date().toISOString()),
    updated_at: String(o.updated_at ?? new Date().toISOString()),
    user_display_name:
      o.user_display_name == null ? null : String(o.user_display_name),
    user_avatar: o.user_avatar == null ? null : String(o.user_avatar),
  }
}

export function useComments(clipId: number) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(
    async (opts?: { silent?: boolean }): Promise<Comment[]> => {
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
      }

      try {
        const response = await fetch(`/api/clips/${clipId}/comments`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch comments')
        }

        const data = (await response.json()) as { comments?: unknown[] }
        const list = (data.comments ?? [])
          .map((row) => parseComment(row, clipId))
          .filter((c): c is Comment => c != null)
        setComments(list)
        return list
      } catch (err) {
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
        console.error('Failed to fetch comments:', err)
        return []
      } finally {
        if (!opts?.silent) {
          setLoading(false)
        }
      }
    },
    [clipId],
  )

  const postComment = useCallback(
    async (content: string, parentCommentId?: number): Promise<boolean> => {
      const trimmed = content.trim()
      if (!trimmed) return false

      try {
        const response = await fetch(`/api/clips/${clipId}/comments`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: trimmed,
            parent_comment_id: parentCommentId ?? null,
          }),
        })

        let body: unknown = null
        try {
          body = await response.json()
        } catch {
          /* empty or non-JSON body */
        }

        if (response.ok) {
          const row = parseComment(body, clipId)
          if (row) {
            setComments((prev) => [row, ...prev.filter((c) => c.id !== row.id)])
          } else {
            await fetchComments()
          }
          setError(null)
          return true
        }

        // Comment may have been saved before a non-critical server step failed
        const refreshed = await fetchComments({ silent: true })
        if (refreshed.some((c) => c.content === trimmed)) {
          setError(null)
          return true
        }
      } catch (err) {
        console.error('Failed to post comment:', err)
        const refreshed = await fetchComments({ silent: true })
        if (refreshed.some((c) => c.content === trimmed)) {
          setError(null)
          return true
        }
      }

      return false
    },
    [clipId, fetchComments],
  )

  useEffect(() => {
    void fetchComments()
  }, [fetchComments])

  return {
    comments,
    loading,
    error,
    postComment,
    refresh: fetchComments,
  }
}
