import { Search, LogOut, User, Bell, Shield, Music, MapPin, Ticket, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { useNavigate } from 'react-router'
import { useNotifications } from '@/react-app/hooks/useNotifications'
import NotificationPanel from './NotificationPanel'
import type { ClipWithUser, ExtendedMochaUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'
import { artistPath, venuePath } from '@/shared/app-paths'

type HeaderSearchPayload = {
  clips: ClipWithUser[]
  artists: { name: string; image_url: string | null; clip_count: number }[]
  venues: { name: string; location: string | null; clip_count: number }[]
  users: {
    mocha_user_id: string
    display_name: string | null
    profile_image_url: string | null
    clip_count: number
  }[]
  jambase?: {
    artists: Record<string, unknown>[]
    venues: Record<string, unknown>[]
    events: Record<string, unknown>[]
  }
}

function jamBaseEventTicket(ev: Record<string, unknown>): string | null {
  const offers = ev.offers
  if (!Array.isArray(offers) || offers.length === 0) {
    return typeof ev.url === 'string' ? ev.url : null
  }
  const primary = offers.find(
    (o: unknown) =>
      typeof o === 'object' &&
      o !== null &&
      (o as Record<string, unknown>).category === 'ticketingLinkPrimary'
  ) as Record<string, unknown> | undefined
  const u = (primary?.url ?? (offers[0] as Record<string, unknown>)?.url) as string | undefined
  return typeof u === 'string' ? u : null
}

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const extendedUser = user as ExtendedMochaUser | null
  const { unreadCount } = useNotifications()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [advancedResults, setAdvancedResults] = useState<HeaderSearchPayload | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchDropdownRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const el = searchDropdownRef.current
      if (!el || !showSearchResults) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [showSearchResults])

  const runAdvancedSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setAdvancedResults(null)
      setSearchLoading(false)
      return
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort()
    }
    searchAbortRef.current = new AbortController()
    setSearchLoading(true)
    try {
      const params = new URLSearchParams({ q: trimmed, compact: '1' })
      const res = await fetch(`/api/search/advanced?${params}`, {
        signal: searchAbortRef.current.signal,
      })
      if (!res.ok) throw new Error('Search failed')
      const data = (await res.json()) as HeaderSearchPayload
      setAdvancedResults(data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Header search failed:', err)
      setAdvancedResults(null)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const scheduleSearch = useCallback(
    (q: string) => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      const trimmed = q.trim()
      if (trimmed.length < 2) {
        setAdvancedResults(null)
        setSearchLoading(false)
        setShowSearchResults(false)
        return
      }
      searchDebounceRef.current = setTimeout(() => {
        void runAdvancedSearch(trimmed)
      }, 280)
    },
    [runAdvancedSearch]
  )

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchAbortRef.current?.abort()
    }
  }, [])

  const isLiveTime = () => {
    const hour = currentTime.getHours()
    return hour >= 20 || hour < 4 // 8PM-4AM EST (accounting for timezone complexity)
  }

  const closeSearchUi = () => {
    setShowSearchResults(false)
    setSearchQuery('')
    setAdvancedResults(null)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchAbortRef.current?.abort()
  }

  const handleSearchInput = (query: string) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      setShowSearchResults(true)
      scheduleSearch(query)
    } else {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchAbortRef.current?.abort()
      setAdvancedResults(null)
      setSearchLoading(false)
      setShowSearchResults(false)
    }
  }

  const goToDiscoverSearch = () => {
    const q = searchQuery.trim()
    if (!q) return
    closeSearchUi()
    navigate(`/discover?q=${encodeURIComponent(q)}`)
  }

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    goToDiscoverSearch()
  }

  const hasAdvancedHits =
    advancedResults &&
    (advancedResults.clips.length > 0 ||
      advancedResults.artists.length > 0 ||
      advancedResults.venues.length > 0 ||
      advancedResults.users.length > 0 ||
      (advancedResults.jambase &&
        (advancedResults.jambase.artists.length > 0 ||
          advancedResults.jambase.venues.length > 0 ||
          advancedResults.jambase.events.length > 0)))

  return (
    <header className="bg-black/95 backdrop-blur-strong border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-4 min-w-0"
          >
            <div className="text-lg sm:text-xl md:text-2xl font-headline bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 bg-clip-text text-transparent truncate">
              MOMENTUM
            </div>
            {isLiveTime() && (
              <div className="hidden sm:flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-full animate-neon-pulse">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-cyan-400 text-xs sm:text-sm font-bold">LIVE</span>
              </div>
            )}
          </button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-white hover:text-blue-400 transition-colors font-medium"
            >
              {/*<Play className="w-4 h-4" aria-hidden />*/}
              Feed
            </button>
            <button
              type="button"
              onClick={() => navigate('/discover')}
              className="flex items-center space-x-2 text-white hover:text-purple-400 transition-colors font-medium"
            >
               {/*<Search className="w-4 h-4" aria-hidden />*/}
              Discover Shows
            </button>
            {/*{user && (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-white hover:text-cyan-400 transition-colors font-medium"
              >
                <User className="w-4 h-4" aria-hidden />
                Profile
              </button>
            )}*/}
            {/*{extendedUser?.profile?.is_premium !== 1 && (
              <button
                type="button"
                onClick={() => navigate('/premium')}
                className="flex items-center space-x-2 text-yellow-400 hover:text-yellow-300 transition-colors font-medium"
                title="Upgrade to Premium"
              >
                <Crown className="w-4 h-4" aria-hidden />
                Premium
              </button>
            )}*/}
          </nav>

          {/* Search & Profile */}
          <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
            <div className="relative hidden lg:block" ref={searchDropdownRef}>
              <form onSubmit={handleHeaderSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
                  placeholder="Search clips, artists, venues..."
                  className="w-48 xl:w-64 pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
                  aria-autocomplete="list"
                  aria-expanded={showSearchResults}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </form>

              {showSearchResults && searchQuery.trim().length >= 2 && (
                <div className="absolute top-full mt-2 w-[28rem] max-w-[90vw] bg-black/95 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden z-50 shadow-xl shadow-cyan-950/40">
                  {searchLoading && (
                    <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      Searching…
                    </div>
                  )}
                  {!searchLoading && advancedResults && !hasAdvancedHits && (
                    <div className="p-4 text-center text-gray-400 text-sm">No matches yet — press Enter for full Discover search</div>
                  )}
                  {!searchLoading && hasAdvancedHits && advancedResults && (
                    <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
                      {advancedResults.clips.length > 0 && (
                        <div className="border-b border-white/10">
                          <div className="px-3 py-2 text-xs font-semibold text-cyan-300/90 uppercase tracking-wide">Clips</div>
                          {advancedResults.clips.map((clip, index) => (
                            <button
                              key={clipListItemKey(clip, index)}
                              type="button"
                              onClick={() => {
                                closeSearchUi()
                                if (clip.artist_name) navigate(artistPath(clip.artist_name))
                                else if (clip.venue_name) navigate(venuePath(clip.venue_name))
                                else navigate('/')
                              }}
                              className="w-full p-3 hover:bg-white/5 transition-colors text-left flex gap-3"
                            >
                              <img
                                src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop'}
                                alt=""
                                className="w-14 h-14 rounded object-cover flex-shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium truncate">{clip.artist_name || 'Clip'}</div>
                                <div className="text-gray-400 text-xs truncate">{clip.venue_name || clip.location || '—'}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {advancedResults.artists.length > 0 && (
                        <div className="border-b border-white/10">
                          <div className="px-3 py-2 text-xs font-semibold text-purple-300/90 uppercase tracking-wide flex items-center gap-1">
                            <Music className="w-3.5 h-3.5" /> Artists (Momentum)
                          </div>
                          {advancedResults.artists.map((a) => (
                            <button
                              key={a.name}
                              type="button"
                              onClick={() => {
                                closeSearchUi()
                                navigate(artistPath(a.name))
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                            >
                              {a.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {advancedResults.venues.length > 0 && (
                        <div className="border-b border-white/10">
                          <div className="px-3 py-2 text-xs font-semibold text-blue-300/90 uppercase tracking-wide flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> Venues (Momentum)
                          </div>
                          {advancedResults.venues.map((v) => (
                            <button
                              key={v.name}
                              type="button"
                              onClick={() => {
                                closeSearchUi()
                                navigate(venuePath(v.name))
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                            >
                              {v.name}
                              {v.location ? <span className="text-gray-500"> · {v.location}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                      {advancedResults.users.length > 0 && (
                        <div className="border-b border-white/10">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Creators</div>
                          {advancedResults.users.map((u) => (
                            <button
                              key={u.mocha_user_id}
                              type="button"
                              onClick={() => {
                                closeSearchUi()
                                navigate(`/users/${u.mocha_user_id}`)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                            >
                              {u.display_name || 'User'}
                            </button>
                          ))}
                        </div>
                      )}
                      {advancedResults.jambase &&
                        (advancedResults.jambase.artists.length > 0 ||
                          advancedResults.jambase.venues.length > 0 ||
                          advancedResults.jambase.events.length > 0) && (
                          <div className="bg-amber-950/20">
                            <div className="px-3 py-2 text-xs font-semibold text-amber-200/90 uppercase tracking-wide flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5" /> JamBase
                            </div>
                            {advancedResults.jambase.artists.map((a) => {
                              const name = typeof a.name === 'string' ? a.name : 'Artist'
                              return (
                                <button
                                  key={typeof a.identifier === 'string' ? a.identifier : name}
                                  type="button"
                                  onClick={() => {
                                    closeSearchUi()
                                    navigate(artistPath(name))
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                                >
                                  {name}
                                </button>
                              )
                            })}
                            {advancedResults.jambase.venues.map((v) => {
                              const name = typeof v.name === 'string' ? v.name : 'Venue'
                              return (
                                <button
                                  key={typeof v.identifier === 'string' ? v.identifier : name}
                                  type="button"
                                  onClick={() => {
                                    closeSearchUi()
                                    navigate(venuePath(name))
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 truncate"
                                >
                                  {name}
                                </button>
                              )
                            })}
                            {advancedResults.jambase.events.slice(0, 4).map((ev) => {
                              const id = typeof ev.identifier === 'string' ? ev.identifier : String(ev.startDate)
                              const title = typeof ev.name === 'string' ? ev.name : 'Show'
                              const ticket = jamBaseEventTicket(ev)
                              return (
                                <div key={id} className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
                                  <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">{title}</span>
                                  {ticket ? (
                                    <a
                                      href={ticket}
                                      target="_blank"
                                      rel="nofollow noopener noreferrer"
                                      className="text-xs text-amber-300 hover:underline flex-shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Tickets
                                    </a>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      <button
                        type="button"
                        onClick={() => goToDiscoverSearch()}
                        className="w-full py-2.5 text-center text-xs text-cyan-400 hover:bg-white/5 border-t border-white/10"
                      >
                        See all results on Discover →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors group"
                >
                  <Bell className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${unreadCount > 0 ? 'animate-pulse' : ''} group-hover:scale-110`} />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-white text-[10px] sm:text-xs flex items-center justify-center font-bold shadow-lg shadow-cyan-500/50 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-cyan-500 rounded-full animate-ping opacity-75" />
                    </>
                  )}
                </button>

                {showNotifications && (
                  <NotificationPanel onClose={() => setShowNotifications(false)} />
                )}
              </div>
            )}
            <div className="text-right hidden xl:block">
              <div className="text-xs text-gray-400">
                {currentTime.toLocaleTimeString('en-US', { 
                  timeZone: 'America/New_York',
                  hour: 'numeric',
                  minute: '2-digit'
                })} EST
              </div>
              <div className="text-xs text-cyan-400">
                {isLiveTime() ? 'Show Time' : 'Show 8PM-12AM'}
              </div>
            </div>
            
            {user ? (
              <div className="flex items-center space-x-0.5 sm:space-x-1 md:space-x-2">
                <button
                  onClick={() => navigate('/upload')}
                  className="hidden md:block px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-lg font-bold text-white hover:scale-105 transition-transform text-xs sm:text-sm md:text-base shadow-lg shadow-cyan-500/30"
                >
                  Share Your Moment
                </button>
                {extendedUser?.profile?.is_admin === 1 && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-purple-400 transition-colors"
                    title="Admin Dashboard"
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors"
                  title="Dashboard"
                >
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={logout}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors hidden md:block"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-lg font-bold text-white hover:scale-105 transition-transform text-xs sm:text-sm md:text-base whitespace-nowrap shadow-lg shadow-cyan-500/30"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
