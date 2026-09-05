"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/** Sort, filter, search and view controls — all reflected in the URL. */
export function FeedControls({ genres, view }: { genres: string[]; view: "list" | "swipe" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  const sort = params.get("sort") ?? "match";
  const genre = params.get("genre") ?? "";

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
      active
        ? "bg-ink text-paper"
        : "border border-hairline bg-paper-raised text-ink-soft hover:border-ink-faint"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5">
        <button className={pill(view === "list")} onClick={() => update({ view: null })}>
          Browse
        </button>
        <button className={pill(view === "swipe")} onClick={() => update({ view: "swipe" })}>
          Swipe
        </button>
      </div>

      <span className="hidden h-5 w-px bg-hairline sm:block" />

      <div className="flex gap-1.5">
        <button className={pill(sort === "match")} onClick={() => update({ sort: null })}>
          Best match
        </button>
        <button className={pill(sort === "newest")} onClick={() => update({ sort: "newest" })}>
          Newest
        </button>
      </div>

      {genres.length > 0 && (
        <select
          value={genre}
          onChange={(e) => update({ genre: e.target.value || null })}
          className="rounded-full border border-hairline bg-paper-raised px-3.5 py-1.5 text-xs font-medium text-ink-soft outline-none transition hover:border-ink-faint"
        >
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q || null });
        }}
        className="ml-auto"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => update({ q: q || null })}
          placeholder="Search tracks…"
          className="w-40 rounded-full border border-hairline bg-paper-raised px-4 py-1.5 text-xs outline-none transition placeholder:text-ink-faint/70 focus:w-52 focus:border-ink-faint"
        />
      </form>
    </div>
  );
}
