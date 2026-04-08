import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';

export const metadata: Metadata = {
  title: "Texas Hold'em Online",
  description: "Play Texas Hold'em poker with friends. Create a table and share the link.",
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
