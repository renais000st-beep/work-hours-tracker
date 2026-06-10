'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  targetSelector: string;
  message: string;
  mode: 'click' | 'button';
  onAdvance: () => void;
  onSkip: () => void;
  t: (key: string) => string;
  skipIfMissing?: boolean;
}

interface TargetState {
  rect: DOMRect;
  el: Element;
}

function findVisibleTarget(selector: string): TargetState | null {
  const elements = document.querySelectorAll(selector);
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return { rect, el };
  }
  return null;
}

export function OnboardingTooltip({ targetSelector, message, mode, onAdvance, onSkip, t, skipIfMissing }: Props) {
  const [target, setTarget] = useState<TargetState | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowLeft: 40, above: false });

  const update = useCallback(() => {
    setTarget(findVisibleTarget(targetSelector));
  }, [targetSelector]);

  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    document.querySelectorAll(targetSelector).forEach(el => ro.observe(el));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetSelector, update]);

  useEffect(() => {
    if (!target) return;
    const { rect } = target;
    const tw = tooltipRef.current?.offsetWidth || 280;
    const th = tooltipRef.current?.offsetHeight || 100;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < th + 24 && rect.top > th + 24;
    const idealLeft = rect.left + rect.width / 2 - tw / 2;
    const clampedLeft = Math.max(12, Math.min(idealLeft, window.innerWidth - tw - 12));
    const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - clampedLeft - 6, tw - 24));
    const top = above ? rect.top - th - 12 : rect.bottom + 12;
    setPos({ top, left: clampedLeft, arrowLeft, above });
  }, [target]);

  // Click-to-advance: add native listener so it fires before React synthetic events
  useEffect(() => {
    if (mode !== 'click' || !target?.el) return;
    const el = target.el;
    const handler = () => onAdvance();
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [mode, target?.el, onAdvance]);

  // Auto-advance if the target element doesn't exist (optional button-mode steps)
  useEffect(() => {
    if (!skipIfMissing) return;
    const timer = setTimeout(() => {
      if (!findVisibleTarget(targetSelector)) onAdvance();
    }, 800);
    return () => clearTimeout(timer);
  }, [targetSelector, skipIfMissing, onAdvance]);

  if (!target) return null;

  const { rect } = target;
  const arrowBorderStyles = pos.above
    ? { borderRight: '1px solid rgb(63 63 70)', borderBottom: '1px solid rgb(63 63 70)' }
    : { borderLeft: '1px solid rgb(63 63 70)', borderTop: '1px solid rgb(63 63 70)' };

  return createPortal(
    <>
      {/* Spotlight ring around target */}
      <div
        className="fixed pointer-events-none z-[9998] rounded-xl onboarding-ring"
        style={{
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />

      {/* Tooltip popover */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl"
        style={{ width: 280, top: pos.top, left: pos.left }}
      >
        {/* Arrow pointing at target */}
        <div
          className="absolute w-3 h-3 bg-zinc-900 rotate-45"
          style={{
            ...(pos.above ? { bottom: -6 } : { top: -6 }),
            left: pos.arrowLeft,
            ...arrowBorderStyles,
          }}
        />
        <p className="text-white text-sm leading-relaxed mb-3">{message}</p>
        <div className="flex items-center gap-2">
          {mode === 'button' && (
            <button
              onClick={onAdvance}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition-colors text-white"
            >
              {t('onboarding.next')}
            </button>
          )}
          <button
            onClick={onSkip}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors ml-auto"
          >
            {t('onboarding.skip')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
