import { Play, Search, LogOut, User, Bell, Shield, Crown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { useNavigate } from 'react-router'
import { useNotifications } from '@/react-app/hooks/useNotifications'
import { useSearch } from '@/react-app/hooks/useSearch'
import NotificationPanel from './NotificationPanel'
import type { ExtendedMochaUser } from '@/shared/types'
import { clipListItemKey } from '@/react-app/lib/clip-list-key'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const extendedUser = user as ExtendedMochaUser | null
  const { unreadCount } = useNotifications()
  const { search, results, clear } = useSearch()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isLiveTime = () => {
    const hour = currentTime.getHours()
    return hour >= 20 || hour < 4 // 8PM-4AM EST (accounting for timezone complexity)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      search(query)
      setShowSearchResults(true)
    } else {
      clear()
      setShowSearchResults(false)
    }
  }

  const handleSearchResultClick = (clip: any) => {
    setShowSearchResults(false)
    setSearchQuery('')
    clear()
    
    // Navigate based on what was clicked
    if (clip.artist_name) {
      navigate(`/artists/${encodeURIComponent(clip.artist_name)}`)
    } else if (clip.venue_name) {
      navigate(`/venues/${encodeURIComponent(clip.venue_name)}`)
    } else {
      navigate('/')
    }
  }

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
            <div className="relative hidden lg:block">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                  placeholder="Search artists, venues..."
                  className="w-48 xl:w-64 pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && results.length > 0 && (
                <div className="absolute top-full mt-2 w-96 bg-black/95 backdrop-blur-lg border border-cyan-500/20 rounded-xl overflow-hidden z-50">
                  <div className="max-h-96 overflow-y-auto">
                    {results.map((clip, index) => (
                      <button
                        key={clipListItemKey(clip, index)}
                        onClick={() => handleSearchResultClick(clip)}
                        className="w-full p-4 hover:bg-white/5 transition-colors text-left border-b border-white/10 last:border-b-0"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={clip.thumbnail_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop'}
                            alt="Clip"
                            className="w-16 h-16 rounded object-cover"
                          />
                          <div className="flex-1">
                            <div className="text-white font-medium">{clip.artist_name || 'Unknown Artist'}</div>
                            <div className="text-gray-400 text-sm">{clip.venue_name || 'Unknown Venue'}</div>
                            <div className="text-gray-500 text-xs">{clip.location}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
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
