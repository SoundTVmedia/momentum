import { useState, useCallback, useRef } from 'react'
import type { ClipWithUser } from '@/shared/types'

/**
 * Enhanced search hook with debouncing and request deduplication
 */
export function useSearch() {
  const [results, setResults] = useState<ClipWithUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    // Cancel previous request if still in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/search/clips?q=${encodeURIComponent(query)}`,
        { signal: abortControllerRef.current.signal }
      )
      
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.clips || [])
    } catch (err) {
      // Don't set error if request was aborted
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        console.error('Search failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setResults([])
    setError(null)
    setLoading(false)
  }, [])

  return {
    results,
    loading,
    error,
    search,
    clear,
  }
}
