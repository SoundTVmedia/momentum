import { Music, Instagram, Twitter, Youtube } from 'lucide-react'
import { Link } from 'react-router'
import { SHOW_FEEDBACK_LIVE_SCHEDULE } from '@/shared/feature-flags'
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext'

function FooterResourceLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="block text-gray-400 hover:text-white transition-colors"
      onClick={() => {
        history.scrollRestoration = 'manual'
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }}
    >
      {children}
    </Link>
  )
}

export default function Footer() {
  const { hideBottomNav: hideSiteChrome } = useMobileChrome()

  if (hideSiteChrome) {
    return null
  }

  return (
    <footer className="glass-chrome border-t border-white/10">
      <div className="md:hidden px-4 py-10 text-center text-xs text-gray-500 space-y-3">
        <div className="flex justify-center gap-3">
          <FooterResourceLink to="/support">Support</FooterResourceLink>
          <FooterResourceLink to="/privacy">Privacy</FooterResourceLink>
          <FooterResourceLink to="/terms">Terms</FooterResourceLink>
        </div>
        <p>© 2026 SoundTV Media Inc.</p>
      </div>
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Music className="w-8 h-8 text-momentum-flare" />
              <span className="text-2xl font-bold bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent">
                FEEDBACK
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Where live music lives online. Join the community that's redefining how we experience concerts.
            </p>
            <div className="flex space-x-4">
              <button className="text-gray-400 hover:text-momentum-flare transition-colors">
                <Instagram className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-momentum-flare transition-colors">
                <Twitter className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-momentum-flare transition-colors">
                <Youtube className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-4">
            <h3 className="font-bold text-white">Platform</h3>
            <div className="space-y-2">
              <FooterResourceLink to="/browse/clips/latest">Concert Feed</FooterResourceLink>
              <FooterResourceLink to="/artist-hub">Artist Hub</FooterResourceLink>
              <FooterResourceLink to="/venue-hub">Venue Hub</FooterResourceLink>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-bold text-white">Resources</h3>
            <div className="space-y-2">
              <FooterResourceLink to="/how-it-works">How It Works</FooterResourceLink>
              <FooterResourceLink to="/community-guidelines">Community Guidelines</FooterResourceLink>
              <FooterResourceLink to="/privacy">Privacy Policy</FooterResourceLink>
              <FooterResourceLink to="/terms">Terms of Service</FooterResourceLink>
              <FooterResourceLink to="/support">Support</FooterResourceLink>
            </div>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-momentum-rose/20 pt-8 mb-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="font-bold text-white mb-2">Stay in the Loop</h3>
            <p className="text-gray-400 mb-4 text-sm">
              Get notified about featured concerts and exclusive FEEDBACK content
            </p>
            <div className="flex space-x-2">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-rose"
              />
              <button className="px-6 py-2 momentum-grad-interactive rounded-lg font-medium text-white hover:scale-105 transition-transform">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {SHOW_FEEDBACK_LIVE_SCHEDULE ? (
          <div className="border-t border-momentum-rose/20 pt-8 mb-8">
            <div className="text-center">
              <h3 className="font-bold text-white mb-4">FEEDBACK Live Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2 max-w-4xl mx-auto">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="bg-black/40 border border-momentum-ember/20 rounded-lg p-3 text-center"
                  >
                    <div className="font-medium text-momentum-flare text-sm">{day}</div>
                    <div className="text-white text-xs mt-1">8PM-12AM</div>
                    <div className="text-gray-300 text-xs">EST</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Copyright */}
        <div className="border-t border-momentum-rose/20 pt-8 text-center">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400 text-sm">
              © 2026 SoundTV Media Inc.
            </div>
            <div className="text-gray-400 text-sm">
              Built for the live music community 🎵
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
