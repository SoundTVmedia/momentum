import { useNavigate } from 'react-router';
import { Home, Search, ArrowLeft } from 'lucide-react';
import Header from '@/react-app/components/Header';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center space-y-8">
          {/* 404 Animation */}
          <div className="relative">
            <div className="text-9xl sm:text-[12rem] font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent animate-pulse">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-momentum-ember/18 to-momentum-flare/12 rounded-full blur-3xl animate-pulse" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              This Page Hit a Wrong Note
            </h1>
            <p className="text-lg text-gray-300 max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved to a different venue
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center space-x-2 px-6 py-3 glass-input rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Go Back</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-105 transition-transform"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </button>

            <button
              onClick={() => navigate('/discover')}
              className="flex items-center space-x-2 px-6 py-3 glass-input rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              <Search className="w-5 h-5" />
              <span>Discover Shows</span>
            </button>
          </div>

          {/* Suggestions */}
          <div className="pt-12 border-t border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">
              Looking for something?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <button
                onClick={() => navigate('/')}
                className="p-4 glass-panel border-momentum-ember/25 glass-panel-hover rounded-xl transition-colors text-left"
              >
                <h3 className="font-bold text-white mb-1">Live Feed</h3>
                <p className="text-sm text-gray-400">See what's happening tonight</p>
              </button>

              <button
                onClick={() => navigate('/discover')}
                className="p-4 glass-panel border-momentum-rose/25 glass-panel-hover rounded-xl transition-colors text-left"
              >
                <h3 className="font-bold text-white mb-1">Discover</h3>
                <p className="text-sm text-gray-400">Find shows and artists</p>
              </button>

              <button
                onClick={() => navigate('/upload')}
                className="p-4 glass-panel border-pink-500/25 glass-panel-hover rounded-xl transition-colors text-left"
              >
                <h3 className="font-bold text-white mb-1">Share a Moment</h3>
                <p className="text-sm text-gray-400">Upload your concert clip</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
