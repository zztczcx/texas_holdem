import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const SITE_URL = 'https://airtexas.club';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Texas Hold'em — Play Poker with Friends",
    template: "%s | airtexas.club",
  },
  description:
    "Host a private Texas Hold'em table and invite friends with a link. No account needed — just pick a name and start playing.",
  applicationName: "airtexas.club",
  keywords: ['texas holdem', 'poker', 'online poker', 'play poker with friends', 'free poker'],
  authors: [{ url: SITE_URL }],
  creator: 'airtexas.club',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: "Texas Hold'em — airtexas.club",
    title: "Play Texas Hold'em with Friends 🃏",
    description:
      "Host a private poker table and invite friends with one link. No account needed.",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Play Texas Hold'em with Friends 🃏",
    description: "Host a private poker table and invite friends with one link. No account needed.",
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className="min-h-dvh">
      <body className="min-h-dvh flex flex-col antialiased overflow-x-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
