import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg">
      <header className="container py-6 sm:py-8">
        <Link href="/" className="inline-block">
          <Wordmark size="md" />
        </Link>
      </header>
      <div className="container flex min-h-[calc(100vh-160px)] items-start justify-center pb-16 sm:items-center">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </div>
    </main>
  );
}
