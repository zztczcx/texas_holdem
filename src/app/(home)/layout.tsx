import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
