// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from '@/lib/i18n';
import { ToastProvider } from '@/app/components/Toast';
import { OnboardingProvider } from '@/lib/onboarding/OnboardingContext';
import { OnboardingRenderer } from '@/lib/onboarding/OnboardingRenderer';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Учёт рабочих часов",
  description: "Arbeitszeiterfassung",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-950 text-white flex flex-col">
        <I18nProvider>
          <ToastProvider>
            <OnboardingProvider>
              <OnboardingRenderer />
              <div className="animate-fade-in flex flex-col flex-1">
                {children}
              </div>
            </OnboardingProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}