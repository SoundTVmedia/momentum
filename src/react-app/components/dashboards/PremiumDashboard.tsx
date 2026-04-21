import { Crown, Ticket, Video, Gift, Star, Zap, Calendar, MessageCircle } from 'lucide-react';
import type { ExtendedMochaUser } from '@/shared/types';

interface PremiumDashboardProps {
  user: ExtendedMochaUser;
}

export default function PremiumDashboard({ user }: PremiumDashboardProps) {
  const displayName = user.profile?.display_name || user.google_user_data.name || 'Member';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Crown className="w-10 h-10 text-yellow-400" />
            <h1 className="text-4xl font-bold text-white">
              Welcome Back, {displayName}
            </h1>
            <div className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-full">
              <span className="text-black font-bold text-sm">VIP</span>
            </div>
          </div>
          <p className="text-gray-300 text-lg">You're in the inner circle</p>
        </div>

        {/* Membership Status */}
        <div className="bg-gradient-to-r from-yellow-400/20 to-amber-600/20 border border-yellow-400/30 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-xl font-bold mb-2">Premium Membership Active</div>
              <div className="text-gray-300">Your exclusive benefits are unlocked</div>
            </div>
            <div className="text-right">
              <div className="text-yellow-400 text-sm mb-1">Renews on</div>
              <div className="text-white font-bold">Dec 12, 2025</div>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button className="bg-gradient-to-r from-yellow-400 to-amber-600 rounded-xl p-6 hover:scale-105 transition-transform">
            <Ticket className="w-8 h-8 text-black mb-2" />
            <div className="text-black font-bold">Early Tickets</div>
            <div className="text-black/80 text-sm">First access</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
            <Video className="w-8 h-8 text-yellow-400 mb-2" />
            <div className="text-white font-bold">Exclusive Videos</div>
            <div className="text-gray-300 text-sm">VIP content</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
            <Gift className="w-8 h-8 text-yellow-400 mb-2" />
            <div className="text-white font-bold">Merch Drops</div>
            <div className="text-gray-300 text-sm">Limited edition</div>
          </button>

          <button className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6 hover:border-yellow-400/50 transition-all">
            <MessageCircle className="w-8 h-8 text-yellow-400 mb-2" />
            <div className="text-white font-bold">Priority Chat</div>
            <div className="text-gray-300 text-sm">Live shows</div>
          </button>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Exclusive Artist Interviews */}
          <div className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Exclusive Interviews</h2>
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden group cursor-pointer">
                <img 
                  src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop"
                  alt="Artist interview"
                  className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                  <div className="p-4 w-full">
                    <div className="flex items-center space-x-2 mb-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 text-xs font-medium">EXCLUSIVE</span>
                    </div>
                    <div className="text-white font-bold mb-1">Behind the Scenes: Arctic Monkeys</div>
                    <div className="text-gray-300 text-sm">45 min • Posted today</div>
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[20px] border-l-white border-y-[12px] border-y-transparent ml-1"></div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold">Backstage with Billie Eilish</div>
                    <div className="text-gray-400 text-sm">32 min • 2 days ago</div>
                  </div>
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold">The Weeknd: Tour Insights</div>
                    <div className="text-gray-400 text-sm">28 min • 4 days ago</div>
                  </div>
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Early Access Tickets */}
          <div className="bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Early Access Tickets</h2>
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-amber-600/10 rounded-lg border border-yellow-500/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Taylor Swift - Los Angeles</div>
                    <div className="text-gray-300 text-sm">SoFi Stadium • Jan 15, 2026</div>
                  </div>
                  <Calendar className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-yellow-400 text-xs font-medium mb-1">EARLY ACCESS</div>
                    <div className="text-gray-400 text-xs">Sale starts in 2 days</div>
                  </div>
                  <button className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-lg font-medium text-black hover:scale-105 transition-transform">
                    Set Reminder
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Bad Bunny World Tour</div>
                    <div className="text-gray-300 text-sm">Multiple cities • Spring 2026</div>
                  </div>
                  <Ticket className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-yellow-400 text-xs font-medium mb-1">PRESALE ACTIVE</div>
                    <div className="text-gray-400 text-xs">24 hours remaining</div>
                  </div>
                  <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium text-white hover:scale-105 transition-transform">
                    Get Tickets
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Coachella 2026</div>
                    <div className="text-gray-300 text-sm">Indio, CA • April 2026</div>
                  </div>
                  <Gift className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-yellow-400 text-xs font-medium mb-1">EARLY BIRD</div>
                    <div className="text-gray-400 text-xs">Coming soon</div>
                  </div>
                  <button className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg font-medium text-white">
                    Notify Me
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exclusive Merchandise */}
        <div className="mt-8 bg-black/40 backdrop-blur-lg border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Exclusive Merchandise Drops</h2>
            <Gift className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Limited Edition Tour Poster', price: '$45', stock: '47 left' },
              { name: 'VIP Member T-Shirt', price: '$35', stock: '124 left' },
              { name: 'Exclusive Vinyl Collection', price: '$120', stock: '12 left' },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="w-full h-32 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-lg mb-3"></div>
                <div className="text-white font-bold mb-1">{item.name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-yellow-400 font-bold">{item.price}</span>
                  <span className="text-gray-400 text-xs">{item.stock}</span>
                </div>
                <button className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-lg font-medium text-black hover:scale-105 transition-transform">
                  Shop Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
