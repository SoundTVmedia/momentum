import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type ProgramApplicationFormShellProps = {
  title: string;
  description: string;
  step: number;
  totalSteps: number;
  stepLabels: string[];
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
  isLastStep: boolean;
  submitting: boolean;
  submitLabel?: string;
  error?: string | null;
  children: ReactNode;
};

export default function ProgramApplicationFormShell({
  title,
  description,
  step,
  totalSteps,
  stepLabels,
  onBack,
  onPrevious,
  onNext,
  canGoNext,
  isLastStep,
  submitting,
  submitLabel = 'Submit application',
  error,
  children,
}: ProgramApplicationFormShellProps) {
  return (
    <div className="min-h-screen text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-300">{description}</p>
        </div>

        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = step === stepNumber;
            const isComplete = step > stepNumber;
            return (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive
                      ? 'bg-momentum-ember text-white'
                      : isComplete
                        ? 'bg-momentum-ember/50 text-white'
                        : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {stepNumber}
                </div>
                <span className={`text-xs sm:text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>
                  {label}
                </span>
                {index < stepLabels.length - 1 ? (
                  <div className="w-8 sm:w-12 h-0.5 bg-gray-700 mx-1" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="glass-panel rounded-2xl p-6 sm:p-8">
          {children}

          {error ? (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onPrevious}
              disabled={step === 1 || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!canGoNext || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg momentum-grad-interactive text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : isLastStep ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {submitLabel}
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          Step {step} of {totalSteps}
        </p>
      </div>
    </div>
  );
}
