import { Music, Instagram, Twitter, Youtube, Download, Smartphone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-cyan-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Music className="w-8 h-8 text-cyan-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                MOMENTUM
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Where live music lives online. Join the community that's redefining how we experience concerts.
            </p>
            <div className="flex space-x-4">
              <button className="text-gray-400 hover:text-cyan-400 transition-colors">
                <Instagram className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-cyan-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-cyan-400 transition-colors">
                <Youtube className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-4">
            <h3 className="font-bold text-white">Platform</h3>
            <div className="space-y-2">
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Live Show</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Concert Feed</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Artist Hub</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Venue Hub</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Community</a>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-bold text-white">Resources</h3>
            <div className="space-y-2">
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">How It Works</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Content Guidelines</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="block text-gray-400 hover:text-white transition-colors">Support</a>
            </div>
          </div>

          {/* Mobile App */}
          <div className="space-y-4">
            <h3 className="font-bold text-white">Get the App</h3>
            <p className="text-gray-400 text-sm">
              Download MOMENTUM to capture and share concert moments
            </p>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors">
                <Download className="w-4 h-4" />
                <span>App Store</span>
              </button>
              <button className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors">
                <Smartphone className="w-4 h-4" />
                <span>Google Play</span>
              </button>
            </div>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-purple-500/20 pt-8 mb-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="font-bold text-white mb-2">Stay in the Loop</h3>
            <p className="text-gray-400 mb-4 text-sm">
              Get notified about featured concerts and exclusive MOMENTUM content
            </p>
            <div className="flex space-x-2">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
              />
              <button className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium text-white hover:scale-105 transition-transform">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Show Schedule */}
        <div className="border-t border-purple-500/20 pt-8 mb-8">
          <div className="text-center">
            <h3 className="font-bold text-white mb-4">MOMENTUM Live Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 max-w-4xl mx-auto">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="bg-black/40 border border-cyan-500/20 rounded-lg p-3 text-center">
                  <div className="font-medium text-cyan-400 text-sm">{day}</div>
                  <div className="text-white text-xs mt-1">8PM-12AM</div>
                  <div className="text-gray-300 text-xs">EST</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-purple-500/20 pt-8 text-center">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-400 text-sm">
              © 2024 MOMENTUM. All rights reserved.
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
