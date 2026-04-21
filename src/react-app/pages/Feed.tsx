import { useState } from 'react';
import { useNavigate } from 'react-router';
import Header from '@/react-app/components/Header';
import ConcertFeed from '@/react-app/components/ConcertFeed';
import FeedFilters from '@/react-app/components/FeedFilters';
import { useAuth } from '@getmocha/users-service/react';
import { Upload } from 'lucide-react';

export default function Feed() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedType, setFeedType] = useState<'latest' | 'trending' | 'most_liked' | 'top_rated'>('latest');

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-headline text-white mb-2">
              The Feed
            </h1>
            <p className="text-gray-400">
              Live moments from concerts happening right now
            </p>
          </div>
          
          {user && (
            <button
              onClick={() => navigate('/upload')}
              className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
            >
              <Upload className="w-5 h-5" />
              <span>Share Moment</span>
            </button>
          )}
        </div>

        {/* Feed Filters */}
        <div className="mb-6">
          <FeedFilters 
            currentFilter={feedType} 
            onFilterChange={setFeedType} 
          />
        </div>

        {/* Concert Feed */}
        <ConcertFeed feedType={feedType} />
      </div>
    </div>
  );
}
