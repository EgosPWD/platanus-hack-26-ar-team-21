import Link from "next/link";

import { Wordmark } from "@/components/shared/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg">
      <header className="container py-8">
        <Link href="/" className="inline-block">
          <Wordmark />
        </Link>
      </header>
      <div className="container flex min-h-[calc(100vh-160px)] items-center justify-center pb-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
