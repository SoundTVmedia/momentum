import { useEffect, useRef, useState } from 'react';
import { CloudUpload, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import Header from '@/react-app/components/Header';
import UploadQueueJobCard from '@/react-app/components/UploadQueueJobCard';
import ClipEditModal from '@/react-app/components/ClipEditModal';
import {
  useClipUploadQueue,
  type ClipUploadQueueJob,
} from '@/react-app/contexts/ClipUploadQueueContext';
import {
  sortUploadJobsForDisplay,
  uploadJobNeedsShowPicker,
} from '@/react-app/lib/upload-outbox/upload-queue-status';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';
import { useEnqueueManualClip } from '@/react-app/hooks/useEnqueueManualClip';
import { pickLibraryVideoFile } from '@/react-app/lib/pickLibraryVideo';
import { isActiveCaptureHandoff } from '@/react-app/lib/upload-outbox/capture-handoff';
import type { ClipWithUser } from '@/shared/types';

export default function UploadQueuePage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const { jobs, restartJob, dismissJob } = useClipUploadQueue();
  const isMobile = useIsMobileViewport();
  const enqueueManualClip = useEnqueueManualClip();
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickerClip, setPickerClip] = useState<ClipWithUser | null>(null);
  const [pickerJobId, setPickerJobId] = useState<string | null>(null);
  const attemptedPickerRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.title = 'Upload Queue';
  }, []);

  useEffect(() => {
    if (!isPending && !user) {
      navigate('/auth', { replace: true });
    }
  }, [isPending, user, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    void Notification.requestPermission().catch(() => {});
  }, []);

  const openShowPicker = async (job: ClipUploadQueueJob) => {
    if (job.clipId == null) {
      setPickError('This clip is still finishing — try Choose show again in a moment.');
      return;
    }
    try {
      const res = await fetch(`/api/clips/${job.clipId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Could not load clip');
      const clip = (await res.json()) as ClipWithUser;
      setPickerClip(clip);
      setPickerJobId(job.id);
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Could not open the show picker');
    }
  };

  useEffect(() => {
    if (pickerClip || isActiveCaptureHandoff()) return;
    const next = jobs.find(
      (job) =>
        uploadJobNeedsShowPicker(job) &&
        job.clipId != null &&
        !attemptedPickerRef.current.has(job.id),
    );
    if (!next) return;
    attemptedPickerRef.current.add(next.id);
    void openShowPicker(next);
  }, [jobs, pickerClip]);

  if (isPending) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <CloudUpload className="w-10 h-10 text-momentum-flare animate-pulse" aria-hidden />
      </div>
    );
  }

  if (!user) return null;

  const startManualUpload = async () => {
    if (!isMobile) {
      navigate('/upload');
      return;
    }
    setPickError(null);
    setPicking(true);
    try {
      const file = await pickLibraryVideoFile();
      if (!file) return;
      const result = await enqueueManualClip(file);
      if (!result.ok) setPickError(result.error);
    } finally {
      setPicking(false);
    }
  };

  const visibleJobs = sortUploadJobsForDisplay(
    jobs.filter(
      (job) =>
        job.status === 'queued' ||
        job.status === 'classifying' ||
        job.status === 'uploading' ||
        job.status === 'completing' ||
        job.status === 'processing' ||
        job.status === 'paused' ||
        job.status === 'waiting' ||
        job.status === 'failed' ||
        job.status === 'published',
    ),
  );

  return (
    <div className="min-h-screen text-white">
      <Header />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Upload Queue</h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Clips you shared keep uploading here in the background. You can keep recording while they
              finish. With no signal they wait for a connection instead of retrying.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void startManualUpload()}
            disabled={picking}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-momentum-ember/35 disabled:opacity-60"
          >
            <Upload className="w-5 h-5" aria-hidden />
            {picking ? 'Opening library…' : 'Upload clip'}
          </button>
        </div>

        {pickError ? (
          <p className="mb-4 text-sm text-red-400" role="alert">
            {pickError}
          </p>
        ) : null}

        {visibleJobs.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <CloudUpload className="w-12 h-12 text-momentum-flare mx-auto mb-4" aria-hidden />
            <h2 className="text-lg font-semibold text-white mb-2">No uploads in progress</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
              When you share a clip, it will show up here until it is posted.
            </p>
            <button
              type="button"
              onClick={() => void startManualUpload()}
              disabled={picking}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 momentum-grad-interactive rounded-lg text-white font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <Upload className="w-5 h-5" aria-hidden />
              {picking ? 'Opening library…' : 'Upload clip'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleJobs.map((job) => (
              <UploadQueueJobCard
                key={job.id}
                job={job}
                onRestart={restartJob}
                onRemove={dismissJob}
                onPickShow={(next) => void openShowPicker(next)}
              />
            ))}
          </div>
        )}
      </div>

      {pickerClip ? (
        <ClipEditModal
          clip={pickerClip}
          enableShowSearch
          onClose={() => {
            setPickerClip(null);
            setPickerJobId(null);
          }}
          onSaved={() => {
            if (pickerJobId) dismissJob(pickerJobId);
            setPickerClip(null);
            setPickerJobId(null);
          }}
        />
      ) : null}
    </div>
  );
}
