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
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
