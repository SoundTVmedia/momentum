import { Music, Video, Users, TrendingUp, Calendar, MessageCircle, Heart, Eye, Star } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import ArtistCurationPanel from '@/react-app/components/ArtistCurationPanel';
import UserAvatar from '@/react-app/components/UserAvatar';
import type { ExtendedMochaUser } from '@/shared/types';
import { useProfileUploadAction } from '@/react-app/lib/profileUploadAction';

interface ArtistDashboardProps {
  user: ExtendedMochaUser;
  onDropClip?: () => void;
}

export default function ArtistDashboard({ user, onDropClip }: ArtistDashboardProps) {
  const navigate = useNavigate();
  const handleUploadClick = useProfileUploadAction(onDropClip);
  const displayName = user.profile?.display_name || user.google_user_data.name || 'Artist';
  const [activeTab, setActiveTab] = useState<'overview' | 'curation'>('overview');

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Music className="w-10 h-10 text-momentum-rose" />
            <h1 className="text-4xl font-bold text-white">
              {displayName}'s Hub
            </h1>
          </div>
          <p className="text-gray-300 text-lg">Your home base for connecting with the community</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-momentum-flare to-momentum-rose text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('curation')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center space-x-2 ${
              activeTab === 'curation'
                ? 'bg-gradient-to-r from-momentum-flare to-momentum-rose text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <Star className="w-5 h-5" />
            <span>Curate Fan Clips</span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={handleUploadClick}
            className="bg-gradient-to-r from-momentum-flare to-momentum-rose rounded-xl p-6 hover:scale-105 transition-transform"
          >
            <Video className="w-8 h-8 text-white mb-2" />
            <div className="text-white font-bold">Drop Content</div>
            <div className="text-white/80 text-sm">Show them what's up</div>
          </button>

          <button className="glass-panel border border-momentum-rose/20 rounded-xl p-6 hover:border-momentum-rose/50 transition-all">
            <Calendar className="w-8 h-8 text-momentum-rose mb-2" />
            <div className="text-white font-bold">Tour Dates</div>
            <div className="text-gray-300 text-sm">Manage schedule</div>
          </button>

          <button className="glass-panel border border-momentum-rose/20 rounded-xl p-6 hover:border-momentum-rose/50 transition-all">
            <MessageCircle className="w-8 h-8 text-momentum-rose mb-2" />
            <div className="text-white font-bold">Fan Chat</div>
            <div className="text-gray-300 text-sm">Talk to your people</div>
          </button>

          <button className="glass-panel border border-momentum-rose/20 rounded-xl p-6 hover:border-momentum-rose/50 transition-all">
            <Users className="w-8 h-8 text-momentum-rose mb-2" />
            <div className="text-white font-bold">Analytics</div>
            <div className="text-gray-300 text-sm">Track growth</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Total Followers</span>
              <Users className="w-5 h-5 text-momentum-rose" />
            </div>
            <div className="text-3xl font-bold text-white">12.4K</div>
            <div className="text-sm text-green-400">+847 this month</div>
          </div>

          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Total Views</span>
              <Eye className="w-5 h-5 text-momentum-flare" />
            </div>
            <div className="text-3xl font-bold text-white">124K</div>
            <div className="text-sm text-green-400">+23K this month</div>
          </div>

          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Engagement Rate</span>
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-white">7.2%</div>
            <div className="text-sm text-green-400">+0.8% this month</div>
          </div>

          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Content Pieces</span>
              <Video className="w-5 h-5 text-momentum-ember" />
            </div>
            <div className="text-3xl font-bold text-white">0</div>
            <div className="text-sm text-gray-400">Start uploading</div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Content */}
          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Your Content</h2>
              <button 
                onClick={handleUploadClick}
                className="text-momentum-rose hover:text-momentum-rose/80 text-sm font-medium"
              >
                Upload New
              </button>
            </div>
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">You haven't uploaded any content yet</p>
              <button 
                onClick={handleUploadClick}
                className="px-6 py-3 bg-gradient-to-r from-momentum-flare to-momentum-rose rounded-xl font-semibold text-white hover:scale-105 transition-transform"
              >
                Upload Your First Clip
              </button>
            </div>
          </div>

          {/* Upcoming Shows */}
          <div className="glass-panel border border-momentum-rose/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Upcoming Shows</h2>
              <button className="text-momentum-rose hover:text-momentum-rose/80 text-sm font-medium">
                Add Show
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Summer Music Festival</div>
                    <div className="text-gray-400 text-sm">Central Park - Jul 15, 2025</div>
                  </div>
                  <Calendar className="w-5 h-5 text-momentum-flare" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">New York, NY</span>
                  <button className="px-3 py-1 bg-momentum-rose/20 text-momentum-rose text-xs rounded hover:bg-momentum-rose/30 transition-colors">
                    Edit
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Hometown Concert</div>
                    <div className="text-gray-400 text-sm">The Forum - Aug 3, 2025</div>
                  </div>
                  <Calendar className="w-5 h-5 text-momentum-flare" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Los Angeles, CA</span>
                  <button className="px-3 py-1 bg-momentum-rose/20 text-momentum-rose text-xs rounded hover:bg-momentum-rose/30 transition-colors">
                    Edit
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white font-bold mb-1">Fall Tour Kickoff</div>
                    <div className="text-gray-400 text-sm">Madison Square Garden - Sep 12, 2025</div>
                  </div>
                  <Calendar className="w-5 h-5 text-momentum-flare" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">New York, NY</span>
                  <button className="px-3 py-1 bg-momentum-rose/20 text-momentum-rose text-xs rounded hover:bg-momentum-rose/30 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fan Engagement */}
        <div className="mt-8 glass-panel border border-momentum-rose/20 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Fan Activity</h2>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-4">
                <UserAvatar
                  displayName="Sarah M."
                  seed="artist-dash-demo-sarah"
                  sizeClass="w-10 h-10"
                  letterClassName="text-sm font-semibold"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Sarah M. started following you</div>
                  <div className="text-gray-400 text-sm">2 hours ago</div>
                </div>
                <button className="px-4 py-2 bg-momentum-rose/20 text-momentum-rose text-sm rounded hover:bg-momentum-rose/30 transition-colors">
                  Follow Back
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-4">
                <UserAvatar
                  displayName="Mike R."
                  seed="artist-dash-demo-mike"
                  sizeClass="w-10 h-10"
                  letterClassName="text-sm font-semibold"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Mike R. commented on your show</div>
                  <div className="text-gray-400 text-sm">5 hours ago</div>
                </div>
                <button className="px-4 py-2 bg-momentum-rose/20 text-momentum-rose text-sm rounded hover:bg-momentum-rose/30 transition-colors">
                  Reply
                </button>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center space-x-4">
                <UserAvatar
                  displayName="Emma L."
                  seed="artist-dash-demo-emma"
                  sizeClass="w-10 h-10"
                  letterClassName="text-sm font-semibold"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Emma L. shared your concert clip</div>
                  <div className="text-gray-400 text-sm">1 day ago</div>
                </div>
                <button className="px-4 py-2 bg-momentum-rose/20 text-momentum-rose text-sm rounded hover:bg-momentum-rose/30 transition-colors">
                  Thank
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Growth Chart Placeholder */}
        <div className="mt-8 glass-panel border border-momentum-rose/20 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Growth Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-momentum-rose mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">+32%</div>
              <div className="text-gray-300 text-sm">Follower Growth</div>
            </div>
            <div className="text-center">
              <Eye className="w-12 h-12 text-momentum-flare mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">+45%</div>
              <div className="text-gray-300 text-sm">View Increase</div>
            </div>
            <div className="text-center">
              <Heart className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">+28%</div>
              <div className="text-gray-300 text-sm">Engagement Up</div>
            </div>
          </div>
        </div>
          </>
        )}

        {activeTab === 'curation' && (
          <ArtistCurationPanel />
        )}
      </div>
    </div>
  );
}
