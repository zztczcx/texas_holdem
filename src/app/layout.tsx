import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: "Texas Hold'em Online",
    template: "%s | Hold'em",
  },
  description: "Play Texas Hold'em poker with friends online. No account required.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className="min-h-dvh">
      <body className="min-h-dvh flex flex-col antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
