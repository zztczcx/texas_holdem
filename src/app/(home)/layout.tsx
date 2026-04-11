import { Header } from '@/components/layout/header';

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
