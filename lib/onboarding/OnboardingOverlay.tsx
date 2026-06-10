'use client';

interface Props {
  title?: string;
  desc: string;
  onNext: () => void;
  onSkip: () => void;
  isFinal?: boolean;
  onTelegramLink?: () => Promise<void>;
  t: (key: string) => string;
}

export function OnboardingOverlay({ title, desc, onNext, onSkip, isFinal, onTelegramLink, t }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        {title && (
          <h2 className="text-2xl font-bold mb-3 text-white">{title}</h2>
        )}
        <p className="text-zinc-300 text-base leading-relaxed mb-6">{desc}</p>
        <div className="flex flex-col gap-3">
          {isFinal && onTelegramLink ? (
            <>
              <button
                onClick={onTelegramLink}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold text-white transition-colors"
              >
                {t('onboarding.step16.linkTelegram')}
              </button>
              <button
                onClick={onNext}
                className="w-full py-3 text-zinc-400 hover:text-white transition-colors text-sm"
              >
                {t('onboarding.step16.skipTelegram')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNext}
                className="w-full py-4 bg-white text-black hover:bg-zinc-100 rounded-2xl font-semibold transition-colors"
              >
                {t('onboarding.next')}
              </button>
              <button
                onClick={onSkip}
                className="w-full py-3 text-zinc-500 hover:text-white transition-colors text-sm"
              >
                {t('onboarding.skip')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
