import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <LogoMark size={40} id="nf" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">No echo here</h1>
        <p className="mt-2 text-sm text-ink-soft">This page doesn&rsquo;t exist — or it never returned.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
        >
          Back to EchoBack
        </Link>
      </div>
    </main>
  );
}
