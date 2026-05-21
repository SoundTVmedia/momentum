import { Star, Video, TrendingUp, DollarSign, Calendar, Users, Zap, Award } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import CollaborationRequest from '@/react-app/components/CollaborationRequest';
import type { ExtendedMochaUser } from '@/shared/types';
import { useProfileUploadAction } from '@/react-app/lib/profileUploadAction';

interface InfluencerDashboardProps {
  user: ExtendedMochaUser;
  onDropClip?: () => void;
}

export default function InfluencerDashboard({ user, onDropClip }: InfluencerDashboardProps) {
  const navigate = useNavigate();
  const handleUploadClick = useProfileUploadAction(onDropClip);
  const displayName = user.profile?.display_name || user.google_user_data.name || 'Influencer';
  
  // Mock collaboration requests - would come from API
  const [collaborations] = useState([
    {
      id: 1,
      artist_name: 'Fender Guitars',
      artist_avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop',
      brief: 'Create a highlight reel of your top 5 moments from guitar-driven shows. Focus on energy and crowd engagement.',
      compensation: '$2,500 + revenue share',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending' as const,
    },
    {
      id: 2,
      artist_name: 'Red Bull Music',
      artist_avatar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop',
      brief: 'Event coverage collaboration for upcoming music festival. Create daily highlight reels and behind-the-scenes content.',
      compensation: '$3,000',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending' as const,
    },
  ]);

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Star className="w-10 h-10 text-momentum-ember" />
            <h1 className="text-4xl font-bold text-white">
              {displayName}'s Creator Hub
            </h1>
          </div>
          <p className="text-gray-300 text-lg">Build your community and get paid for what you love</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={handleUploadClick}
            className="momentum-grad-interactive rounded-xl p-6 hover:scale-105 transition-transform"
          >
            <Video className="w-8 h-8 text-white mb-2" />
            <div className="text-white font-bold">Make a Reel</div>
            <div className="text-white/80 text-sm">Curate the best moments</div>
          </button>

          <button className="glass-panel border border-momentum-ember/20 rounded-xl p-6 hover:border-momentum-ember/50 transition-all">
            <Calendar className="w-8 h-8 text-momentum-ember mb-2" />
            <div className="text-white font-bold">Content Calendar</div>
            <div className="text-gray-300 text-sm">Plan posts</div>
          </button>

          <button className="glass-panel border border-momentum-ember/20 rounded-xl p-6 hover:border-momentum-ember/50 transition-all">
            <Users className="w-8 h-8 text-momentum-ember mb-2" />
            <div className="text-white font-bold">Collaborations</div>
            <div className="text-gray-300 text-sm">Partner requests</div>
          </button>

          <button className="glass-panel border border-momentum-ember/20 rounded-xl p-6 hover:border-momentum-ember/50 transition-all">
            <DollarSign className="w-8 h-8 text-momentum-ember mb-2" />
            <div className="text-white font-bold">Monetization</div>
            <div className="text-gray-300 text-sm">Track earnings</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Total Followers</span>
              <Users className="w-5 h-5 text-momentum-ember" />
            </div>
            <div className="text-3xl font-bold text-white">45.2K</div>
            <div className="text-sm text-green-400">+2.3K this month</div>
          </div>

          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Monthly Reach</span>
              <TrendingUp className="w-5 h-5 text-momentum-flare" />
            </div>
            <div className="text-3xl font-bold text-white">328K</div>
            <div className="text-sm text-green-400">+47K this week</div>
          </div>

          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Engagement Rate</span>
              <Zap className="w-5 h-5 text-momentum-ember" />
            </div>
            <div className="text-3xl font-bold text-white">8.4%</div>
            <div className="text-sm text-green-400">+1.2% this week</div>
          </div>

          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Monthly Revenue</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white">$3.2K</div>
            <div className="text-sm text-green-400">+$840 this week</div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Content Performance */}
          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Recent Content</h2>
              <button className="text-momentum-ember hover:text-momentum-glacier text-sm font-medium">
                View All
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-momentum-ember to-momentum-flare rounded-lg flex items-center justify-center">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold mb-1">NYC Rock Scene Highlights</div>
                    <div className="text-gray-400 text-sm mb-2">Posted 2 days ago</div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-momentum-flare">12.4K views</span>
                      <span className="text-red-400">847 likes</span>
                      <span className="text-momentum-flare">132 shares</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-momentum-flare to-momentum-rose rounded-lg flex items-center justify-center">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold mb-1">Best Moments This Week</div>
                    <div className="text-gray-400 text-sm mb-2">Posted 5 days ago</div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-momentum-flare">28.1K views</span>
                      <span className="text-red-400">1.9K likes</span>
                      <span className="text-momentum-flare">342 shares</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collaboration Requests */}
          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Collaboration Requests</h2>
              <span className="px-3 py-1 bg-momentum-ember/15 text-momentum-ember text-sm rounded-full font-medium">
                {collaborations.filter(c => c.status === 'pending').length} Pending
              </span>
            </div>
            <div className="space-y-4">
              {collaborations.map((collab) => (
                <CollaborationRequest key={collab.id} request={collab} />
              ))}
            </div>
          </div>

          {/* Brand Partnerships - Legacy */}
          <div className="glass-panel border border-momentum-ember/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Ongoing Partnerships</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Fender Guitars</div>
                    <div className="text-gray-400 text-sm">Sponsored content opportunity</div>
                  </div>
                  <Award className="w-6 h-6 text-momentum-ember" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-400 font-bold">$2,500</span>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors">
                      Decline
                    </button>
                    <button className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded hover:bg-green-500/30 transition-colors">
                      Accept
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Ticketmaster</div>
                    <div className="text-gray-400 text-sm">Affiliate partnership program</div>
                  </div>
                  <Award className="w-6 h-6 text-momentum-flare" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-400 font-bold">15% commission</span>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors">
                      Decline
                    </button>
                    <button className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded hover:bg-green-500/30 transition-colors">
                      Accept
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-white font-bold mb-1">Red Bull Music</div>
                    <div className="text-gray-400 text-sm">Event coverage collaboration</div>
                  </div>
                  <Award className="w-6 h-6 text-momentum-flare" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-400 font-bold">$3,000</span>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors">
                      Decline
                    </button>
                    <button className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded hover:bg-green-500/30 transition-colors">
                      Accept
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
