import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AoE2 2v2 Team Win Rates',
  description:
    'Age of Empires II Definitive Edition — ranked 2v2 Random Map team civilization win rates by map',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
