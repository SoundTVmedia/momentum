import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearPendingTour,
  resolveVisibleTourSteps,
  targetForStep,
  type ProductTourStep,
} from '@/react-app/lib/productTour';

export type ProductTourState = {
  active: boolean;
  steps: ProductTourStep[];
  stepIndex: number;
  step: ProductTourStep | null;
  target: HTMLElement | null;
  targetRect: DOMRect | null;
  startTour: () => void;
  next: () => void;
  back: () => void;
  dismissTour: () => void;
};

const TARGET_RETRY_MS = 50;
const TARGET_RETRY_MAX = 20;

function readTargetRect(el: HTMLElement | null): DOMRect | null {
  if (!el) return null;
  return el.getBoundingClientRect();
}

export function useProductTour(): ProductTourState {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<ProductTourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const retryRef = useRef<number | null>(null);

  const clearRetry = useCallback(() => {
    if (retryRef.current != null) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const dismissTour = useCallback(() => {
    clearRetry();
    clearPendingTour();
    setActive(false);
    setSteps([]);
    setStepIndex(0);
    setTarget(null);
    setTargetRect(null);
  }, [clearRetry]);

  const applyStep = useCallback(
    (nextSteps: ProductTourStep[], index: number) => {
      const step = nextSteps[index];
      if (!step) {
        dismissTour();
        return;
      }
      const el = targetForStep(step);
      setSteps(nextSteps);
      setStepIndex(index);
      setTarget(el);
      setTargetRect(readTargetRect(el));
      if (el) {
        const reduce =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: reduce ? 'auto' : 'smooth',
        });
        window.setTimeout(() => {
          setTargetRect(readTargetRect(el));
        }, reduce ? 0 : 280);
      }
    },
    [dismissTour],
  );

  const startTour = useCallback(() => {
    clearRetry();
    setActive(true);
    setStepIndex(0);
    setTarget(null);
    setTargetRect(null);

    let attempts = 0;
    const tryResolve = () => {
      const nextSteps = resolveVisibleTourSteps();
      const ready = nextSteps.length >= 3 || attempts >= TARGET_RETRY_MAX - 1;
      if (nextSteps.length > 0 && ready) {
        applyStep(nextSteps, 0);
        return;
      }
      attempts += 1;
      if (attempts >= TARGET_RETRY_MAX) {
        if (nextSteps.length > 0) {
          applyStep(nextSteps, 0);
        } else {
          dismissTour();
        }
        return;
      }
      retryRef.current = window.setTimeout(tryResolve, TARGET_RETRY_MS);
    };
    tryResolve();
  }, [applyStep, clearRetry, dismissTour]);

  const next = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      dismissTour();
      return;
    }
    applyStep(steps, nextIndex);
  }, [applyStep, dismissTour, stepIndex, steps]);

  const back = useCallback(() => {
    if (stepIndex <= 0) return;
    applyStep(steps, stepIndex - 1);
  }, [applyStep, stepIndex, steps]);

  useEffect(() => {
    if (!active) return;

    const syncRect = () => {
      setTargetRect(readTargetRect(target));
    };
    window.addEventListener('resize', syncRect);
    window.addEventListener('scroll', syncRect, true);
    window.visualViewport?.addEventListener('resize', syncRect);
    window.visualViewport?.addEventListener('scroll', syncRect);
    return () => {
      window.removeEventListener('resize', syncRect);
      window.removeEventListener('scroll', syncRect, true);
      window.visualViewport?.removeEventListener('resize', syncRect);
      window.visualViewport?.removeEventListener('scroll', syncRect);
    };
  }, [active, target]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissTour();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, dismissTour]);

  useEffect(() => () => clearRetry(), [clearRetry]);

  const step = steps[stepIndex] ?? null;

  return {
    active,
    steps,
    stepIndex,
    step,
    target,
    targetRect,
    startTour,
    next,
    back,
    dismissTour,
  };
}
