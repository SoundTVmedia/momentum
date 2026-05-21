import { useState, useEffect } from 'react';
import { Shield, Check, X, Eye, Loader2, ExternalLink } from 'lucide-react';
import UserAvatar from '@/react-app/components/UserAvatar';

interface VerificationRequest {
  id: number;
  mocha_user_id: string;
  full_name: string;
  reason: string;
  proof_url: string;
  social_links: string;
  status: string;
  display_name: string;
  role: string;
  profile_image_url: string;
  created_at: string;
}

export default function VerificationAdminPanel() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/verification-requests?status=${statusFilter}`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: number, action: 'approve' | 'reject') => {
    setReviewing(true);
    try {
      const response = await fetch(`/api/admin/verification-requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejection_reason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (response.ok) {
        setSelectedRequest(null);
        setRejectionReason('');
        fetchRequests();
      }
    } catch (error) {
      console.error('Failed to review request:', error);
    } finally {
      setReviewing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-momentum-ember/15 text-momentum-ember border-momentum-ember/25';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Shield className="w-6 h-6 text-momentum-flare" />
          <span>Verification Requests</span>
        </h2>
        
        {/* Status Filter */}
        <div className="flex space-x-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize text-sm ${
                statusFilter === status
                  ? 'bg-momentum-ember/20 text-momentum-flare border border-momentum-ember/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin mx-auto" />
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} verification requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="glass-panel border border-white/10 rounded-xl p-6 hover:border-momentum-ember/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <UserAvatar
                    imageUrl={request.profile_image_url || null}
                    displayName={request.full_name || request.display_name}
                    seed={request.mocha_user_id}
                    alt={request.display_name}
                    sizeClass="w-12 h-12"
                    letterClassName="text-base font-semibold"
                    className="border-2 border-momentum-ember/40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{request.full_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                      <span className="px-2 py-0.5 bg-momentum-rose/20 text-momentum-rose rounded-full text-xs font-semibold capitalize">
                        {request.role}
                      </span>
                    </div>
                    <div className="text-gray-400 text-sm mb-2">@{request.display_name}</div>
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{request.reason}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <a
                        href={request.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-momentum-flare hover:text-momentum-flare/90"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Proof Link</span>
                      </a>
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="flex items-center space-x-1 text-momentum-flare hover:text-blue-300"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>
                </div>

                {request.status === 'pending' && (
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleReview(request.id, 'approve')}
                      disabled={reviewing}
                      className="p-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      title="Approve"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      disabled={reviewing}
                      className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      title="Reject"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-gradient-to-b from-slate-900 to-black border border-momentum-ember/20 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-momentum-ember/20 to-momentum-flare/12 border-b border-white/10 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Review Verification Request</h2>
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setRejectionReason('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start space-x-4 mb-6">
                <UserAvatar
                  imageUrl={selectedRequest.profile_image_url || null}
                  displayName={selectedRequest.full_name || selectedRequest.display_name}
                  seed={selectedRequest.mocha_user_id}
                  alt={selectedRequest.display_name}
                  sizeClass="w-16 h-16"
                  letterClassName="text-xl font-semibold"
                  className="border-2 border-momentum-ember/40"
                />
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{selectedRequest.full_name}</h3>
                  <div className="text-gray-400">@{selectedRequest.display_name}</div>
                  <div className="text-sm text-momentum-rose capitalize mt-1">{selectedRequest.role}</div>
                </div>
              </div>

              <div>
                <h4 className="text-white font-medium mb-2">Reason for Verification:</h4>
                <p className="text-gray-300 bg-white/5 p-4 rounded-lg">{selectedRequest.reason}</p>
              </div>

              <div>
                <h4 className="text-white font-medium mb-2">Proof:</h4>
                <a
                  href={selectedRequest.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-momentum-flare hover:text-momentum-flare/90"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="break-all">{selectedRequest.proof_url}</span>
                </a>
              </div>

              <div>
                <h4 className="text-white font-medium mb-2">Social Links:</h4>
                <div className="bg-white/5 p-4 rounded-lg">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap break-all">
                    {selectedRequest.social_links}
                  </p>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <>
                  <div>
                    <label className="block text-white font-medium mb-2">Rejection Reason (Optional)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-momentum-flare resize-none"
                      placeholder="Provide a reason if rejecting..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => handleReview(selectedRequest.id, 'reject')}
                      disabled={reviewing}
                      className="flex-1 px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-xl font-semibold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {reviewing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <X className="w-5 h-5 mr-2" />
                          Reject
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReview(selectedRequest.id, 'approve')}
                      disabled={reviewing}
                      className="flex-1 px-6 py-3 bg-green-500/20 border border-green-500/30 rounded-xl font-semibold text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      {reviewing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-5 h-5 mr-2" />
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
