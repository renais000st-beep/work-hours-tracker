'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { DriveStep } from 'driver.js';

type TourName = 'dashboard_calendar' | 'dashboard_stats' | 'schedule';

export function useTour(
  tourName: TourName,
  getSteps: (t: (key: string) => string) => DriveStep[],
  ready = true
): { startTour: () => void } {
  const { t } = useTranslation();
  const hasAutoStarted = useRef(false);
  const tRef = useRef(t);
  const getStepsRef = useRef(getSteps);

  useEffect(() => { tRef.current = t; });
  useEffect(() => { getStepsRef.current = getSteps; });

  const startTour = useCallback(async () => {
    const { driver } = await import('driver.js');

    const allSteps = getStepsRef.current(tRef.current);
    // Skip steps where the target element doesn't exist in DOM
    const steps = allSteps.filter(step => {
      if (!step.element) return true;
      return !!document.querySelector(step.element as string);
    });

    if (steps.length === 0) return;

    const driverObj = driver({
      animate: true,
      overlayOpacity: 0.75,
      smoothScroll: true,
      nextBtnText: tRef.current('tour.next'),
      prevBtnText: tRef.current('tour.prev'),
      doneBtnText: tRef.current('tour.done'),
      onDestroyed: () => {
        localStorage.setItem(`tour_${tourName}_done`, 'true');
      },
      steps,
    });

    driverObj.drive();
  }, [tourName]);

  useEffect(() => {
    if (tourName === 'dashboard_stats') return;
    if (!ready) return;
    if (hasAutoStarted.current) return;
    if (localStorage.getItem(`tour_${tourName}_done`)) return;

    hasAutoStarted.current = true;
    const timer = setTimeout(startTour, 400);
    return () => clearTimeout(timer);
  }, [ready, tourName, startTour]);

  return { startTour };
}
