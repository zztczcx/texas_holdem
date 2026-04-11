import { Header } from '@/components/layout/header';

export default function GameLayout({
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
