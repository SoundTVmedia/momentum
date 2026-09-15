import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ProductTourStep } from '@/react-app/lib/productTour';

type ProductTourOverlayProps = {
  active: boolean;
  step: ProductTourStep | null;
  stepIndex: number;
  stepCount: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onBack: () => void;
  onDismiss: () => void;
};

const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 12;
const SPOTLIGHT_PAD = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function ProductTourOverlay({
  active,
  step,
  stepIndex,
  stepCount,
  targetRect,
  onNext,
  onBack,
  onDismiss,
}: ProductTourOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 16, left: 16, width: TOOLTIP_WIDTH });

  useEffect(() => {
    if (!active) return;
    exitRef.current?.focus();
  }, [active, stepIndex]);

  useLayoutEffect(() => {
    if (!active) return;
    const width = Math.min(TOOLTIP_WIDTH, Math.max(240, window.innerWidth - 24));
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 180;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    if (!targetRect) {
      setTooltipPos({
        top: Math.max(16, (viewH - tooltipHeight) / 2),
        left: (viewW - width) / 2,
        width,
      });
      return;
    }

    const left = clamp(
      targetRect.left + targetRect.width / 2 - width / 2,
      12,
      viewW - width - 12,
    );
    const below = targetRect.bottom + SPOTLIGHT_PAD + TOOLTIP_GAP;
    const above = targetRect.top - SPOTLIGHT_PAD - TOOLTIP_GAP - tooltipHeight;
    const fitsBelow = below + tooltipHeight <= viewH - 12;
    const top = fitsBelow ? below : Math.max(12, above);
    setTooltipPos({ top, left, width });
  }, [active, stepIndex, targetRect]);

  if (!active || typeof document === 'undefined') return null;

  const isLast = stepIndex >= stepCount - 1;
  const labelId = 'product-tour-title';
  const descId = 'product-tour-body';

  const spotlight = targetRect
    ? {
        top: targetRect.top - SPOTLIGHT_PAD,
        left: targetRect.left - SPOTLIGHT_PAD,
        width: targetRect.width + SPOTLIGHT_PAD * 2,
        height: targetRect.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-hidden" data-product-tour="overlay">
      <button
        type="button"
        className={`absolute inset-0 cursor-default ${spotlight ? 'bg-transparent' : 'bg-black/55'}`}
        aria-label="Exit tour"
        onClick={onDismiss}
      />
      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-momentum-flare/90"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
          aria-hidden
        />
      ) : null}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={descId}
        className="absolute z-10 rounded-2xl border border-white/40 bg-black/90 p-4 text-white shadow-2xl backdrop-blur-lg"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tooltipPos.width,
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/55">
              {stepCount > 0 ? `${stepIndex + 1} of ${stepCount}` : ''}
            </p>
            <h2 id={labelId} className="mt-1 font-headline text-lg tracking-tight text-white">
              {step?.title ?? 'Tour'}
            </h2>
          </div>
          <button
            ref={exitRef}
            type="button"
            className="shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Exit tour"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p id={descId} className="text-sm leading-relaxed text-white/80">
          {step?.body}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onDismiss}
          >
            Exit tour
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-white/30 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              onClick={onBack}
              disabled={stepIndex <= 0}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-white momentum-grad-interactive"
              onClick={onNext}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
