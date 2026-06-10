import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Work Hours',
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
