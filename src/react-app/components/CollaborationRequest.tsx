import { useState } from 'react';
import { Star, Check, X, DollarSign, Briefcase } from 'lucide-react';

interface CollaborationRequestProps {
  request: {
    id: number;
    artist_name: string;
    artist_avatar?: string;
    brief: string;
    compensation: string;
    deadline: string;
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
  };
  onAccept?: (id: number) => void;
  onReject?: (id: number) => void;
}

export default function CollaborationRequest({ 
  request, 
  onAccept, 
  onReject 
}: CollaborationRequestProps) {
  const [responding, setResponding] = useState(false);

  const handleAccept = async () => {
    setResponding(true);
    try {
      const response = await fetch(`/api/collaborations/${request.id}/accept`, {
        method: 'POST',
      });

      if (response.ok && onAccept) {
        onAccept(request.id);
      }
    } catch (error) {
      console.error('Failed to accept collaboration:', error);
    } finally {
      setResponding(false);
    }
  };

  const handleReject = async () => {
    setResponding(true);
    try {
      const response = await fetch(`/api/collaborations/${request.id}/reject`, {
        method: 'POST',
      });

      if (response.ok && onReject) {
        onReject(request.id);
      }
    } catch (error) {
      console.error('Failed to reject collaboration:', error);
    } finally {
      setResponding(false);
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'accepted':
        return (
          <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs font-medium">
            In Progress
          </div>
        );
      case 'completed':
        return (
          <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs font-medium">
            Completed
          </div>
        );
      case 'rejected':
        return (
          <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs font-medium">
            Declined
          </div>
        );
      default:
        return (
          <div className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-xs font-medium">
            Pending
          </div>
        );
    }
  };

  return (
    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img
            src={request.artist_avatar || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop'}
            alt={request.artist_name}
            className="w-12 h-12 rounded-full border-2 border-yellow-500/40"
          />
          <div>
            <div className="text-white font-bold text-lg">{request.artist_name}</div>
            <div className="text-gray-400 text-sm">Official Collaboration Request</div>
          </div>
        </div>
        {getStatusBadge()}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Briefcase className="w-4 h-4 text-yellow-400" />
            <div className="text-sm font-medium text-gray-300">Brief</div>
          </div>
          <p className="text-white">{request.brief}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <div className="text-sm font-medium text-gray-300">Compensation</div>
            </div>
            <div className="text-white font-bold">{request.compensation}</div>
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <div className="text-sm font-medium text-gray-300">Deadline</div>
            </div>
            <div className="text-white font-medium">
              {new Date(request.deadline).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>

      {request.status === 'pending' && (
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReject}
            disabled={responding}
            className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <X className="w-5 h-5" />
            <span>Decline</span>
          </button>
          
          <button
            onClick={handleAccept}
            disabled={responding}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Check className="w-5 h-5" />
            <span>Accept</span>
          </button>
        </div>
      )}

      {request.status === 'accepted' && (
        <button className="w-full px-4 py-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 font-medium hover:bg-blue-500/30 transition-colors">
          View Project Details
        </button>
      )}

      {request.status === 'completed' && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center space-x-2 text-green-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">Project completed and published!</span>
          </div>
        </div>
      )}
    </div>
  );
}
