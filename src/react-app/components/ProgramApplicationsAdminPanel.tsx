import { useEffect, useState } from 'react';
import {
  Check,
  ClipboardList,
  ExternalLink,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';
import UserAvatar from '@/react-app/components/UserAvatar';
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  REVIEW_RECOMMENDATION_LABELS,
  getReviewRecommendation,
  type ApplicationStatus,
  type ApplicationType,
} from '@/shared/program-applications';

type ProgramApplication = {
  id: string;
  userId?: string;
  type: ApplicationType;
  status: ApplicationStatus;
  formData: Record<string, unknown>;
  confidenceScore?: number;
  reviewNotes?: string;
  submittedAt?: string;
  displayName?: string;
  role?: string;
  profileImageUrl?: string;
};

export default function ProgramApplicationsAdminPanel() {
  const [applications, setApplications] = useState<ProgramApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('submitted');
  const [typeFilter, setTypeFilter] = useState<ApplicationType | 'all'>('all');
  const [selected, setSelected] = useState<ProgramApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    void fetchApplications();
  }, [statusFilter, typeFilter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const response = await fetch(`/api/admin/program-applications?${params.toString()}`);
      if (response.ok) {
        const data = (await response.json()) as { applications?: ProgramApplication[] };
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Failed to fetch program applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (
    applicationId: string,
    action: 'approve' | 'reject' | 'needs_more_info' | 'under_review',
  ) => {
    setReviewing(true);
    try {
      const response = await fetch(`/api/admin/program-applications/${applicationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_notes: reviewNotes || undefined }),
      });
      if (response.ok) {
        setSelected(null);
        setReviewNotes('');
        void fetchApplications();
      }
    } catch (error) {
      console.error('Failed to review application:', error);
    } finally {
      setReviewing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'under_review':
        return 'bg-momentum-ember/15 text-momentum-ember border-momentum-ember/25';
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'needs_more_info':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const renderFormValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value == null) return '—';
    return String(value);
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-momentum-flare" />
          <span>Program Applications</span>
        </h2>

        <div className="flex flex-wrap gap-2">
          {(['submitted', 'under_review', 'needs_more_info', 'approved', 'rejected', 'all'] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  statusFilter === status
                    ? 'bg-momentum-ember/20 text-momentum-flare border border-momentum-ember/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {status === 'all' ? 'All' : APPLICATION_STATUS_LABELS[status]}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'ambassador', 'influencer', 'sponsor'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === type
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {type === 'all' ? 'All types' : APPLICATION_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-momentum-flare animate-spin mx-auto" />
        </div>
      ) : applications.length === 0 ? (
        <div className="glass-panel border border-white/10 rounded-xl p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No applications in this queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const score = app.confidenceScore ?? 0;
            const recommendation = getReviewRecommendation(score);
            const name =
              (app.formData.fullName as string) ||
              (app.formData.companyName as string) ||
              app.displayName ||
              'Applicant';

            return (
              <div
                key={app.id}
                className="glass-panel border border-white/10 rounded-xl p-6 hover:border-momentum-ember/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <UserAvatar
                      imageUrl={app.profileImageUrl || null}
                      displayName={name}
                      seed={app.userId || app.id}
                      alt={name}
                      sizeClass="w-12 h-12"
                      letterClassName="text-base font-semibold"
                      className="border-2 border-momentum-ember/40"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-white">{name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(app.status)}`}>
                          {APPLICATION_STATUS_LABELS[app.status]}
                        </span>
                        <span className="px-2 py-0.5 bg-momentum-rose/20 text-momentum-rose rounded-full text-xs font-semibold">
                          {APPLICATION_TYPE_LABELS[app.type]}
                        </span>
                        <span className="px-2 py-0.5 bg-white/10 text-gray-200 rounded-full text-xs font-semibold">
                          Score: {score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{REVIEW_RECOMMENDATION_LABELS[recommendation]}</p>
                      {app.submittedAt ? (
                        <p className="text-xs text-gray-500">
                          Submitted {new Date(app.submittedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(app);
                      setReviewNotes(app.reviewNotes || '');
                    }}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10"
                  >
                    Review
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="glass-panel border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {APPLICATION_TYPE_LABELS[selected.type]} application
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Score {selected.confidenceScore ?? 0} —{' '}
                  {REVIEW_RECOMMENDATION_LABELS[getReviewRecommendation(selected.confidenceScore ?? 0)]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {Object.entries(selected.formData).map(([key, value]) => {
                if (key === 'consent') return null;
                const display = renderFormValue(value);
                const isUrlField =
                  key.toLowerCase().includes('url') ||
                  key.toLowerCase().includes('links') ||
                  key === 'website' ||
                  key === 'logoUrl';

                return (
                  <div key={key} className="border-b border-white/5 pb-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </div>
                    {isUrlField && typeof value === 'string' && value.startsWith('http') ? (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-momentum-flare hover:underline inline-flex items-center gap-1"
                      >
                        {value}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : isUrlField && Array.isArray(value) ? (
                      <div className="space-y-1">
                        {value.map((url) => (
                          <a
                            key={String(url)}
                            href={String(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-momentum-flare hover:underline"
                          >
                            {String(url)}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{display}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <MessageSquare className="w-4 h-4" />
                Reviewer notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full glass-input rounded-lg px-3 py-2 text-white"
                placeholder="Notes for the team or applicant..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void handleReview(selected.id, 'approve')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void handleReview(selected.id, 'needs_more_info')}
                className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50"
              >
                Request info
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void handleReview(selected.id, 'under_review')}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50"
              >
                Mark under review
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void handleReview(selected.id, 'reject')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
