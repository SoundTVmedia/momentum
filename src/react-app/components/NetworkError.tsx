import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
  type?: 'offline' | 'slow' | 'failed';
}

export default function NetworkError({ 
  onRetry, 
  message,
  type = 'failed' 
}: NetworkErrorProps) {
  const getIcon = () => {
    switch (type) {
      case 'offline':
        return <WifiOff className="w-12 h-12 text-red-400" />;
      case 'slow':
        return <AlertCircle className="w-12 h-12 text-yellow-400" />;
      default:
        return <AlertCircle className="w-12 h-12 text-orange-400" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'offline':
        return 'No Internet Connection';
      case 'slow':
        return 'Slow Connection';
      default:
        return 'Connection Failed';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'offline':
        return 'Check your internet connection and try again';
      case 'slow':
        return 'Your connection is slow. Some features may not work properly';
      default:
        return 'We couldn\'t load this content. Please try again';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-4">{getIcon()}</div>
      
      <h3 className="text-xl font-bold text-white mb-2">
        {getTitle()}
      </h3>
      
      <p className="text-gray-300 mb-6 max-w-sm">
        {message || getDefaultMessage()}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}

// Inline component for small error states
export function InlineNetworkError({ 
  onRetry, 
  message = 'Failed to load' 
}: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <div className="flex items-center space-x-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <p className="text-red-300 text-sm">{message}</p>
      </div>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-1 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
