import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ProfileProvider } from "@/lib/profile-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdmitPath",
  description:
    "See where you can realistically get in. Admission averages, prerequisites, and Safe/Target/Reach labels for university programs across Canada.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900">
        <ProfileProvider>
          <header id="site-header" className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-12 w-full max-w-[40rem] items-center px-4">
              <Link
                href="/"
                className="rounded text-lg font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Admit<span className="text-blue-600">Path</span>
              </Link>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[40rem] flex-1 px-4 pb-16">{children}</main>

          <footer id="site-footer" className="border-t border-slate-200 bg-white">
            <div className="mx-auto w-full max-w-[40rem] px-4 py-6 text-xs leading-relaxed text-slate-500">
              <p>
                Admission data changes every year — always confirm requirements and averages on the
                official program page before applying. Ranges marked &ldquo;estimated&rdquo; are not
                official published cutoffs.
              </p>
            </div>
          </footer>
        </ProfileProvider>
      </body>
    </html>
  );
}
