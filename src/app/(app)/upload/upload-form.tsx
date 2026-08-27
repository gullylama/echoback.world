"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

export function UploadForm({
  action,
  titleLabel,
  placeholder,
  demoMode,
  isCreator,
}: {
  action: (formData: FormData) => Promise<void>;
  titleLabel: string;
  placeholder: string;
  demoMode: boolean;
  isCreator: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="mt-10 flex flex-col gap-6">
      <label className="group flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-hairline bg-paper-raised px-6 py-12 text-center transition hover:border-ink-faint">
        <span className="grad-audio block h-[3px] w-16 rounded-full transition group-hover:w-24" />
        <span className="mt-5 text-sm font-medium">
          {fileName ?? "Drop audio here, or browse"}
        </span>
        <span className="mt-1.5 text-xs text-ink-faint">
          mp3 · wav · m4a — up to 50MB{demoMode ? " (optional in demo mode)" : ""}
        </span>
        <input
          type="file"
          name="file"
          accept=".mp3,.wav,.m4a,audio/*"
          required={!demoMode}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="label text-ink-faint">{titleLabel}</span>
        <input
          name="title"
          required
          maxLength={80}
          placeholder={placeholder}
          className="rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint"
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper-raised p-5">
        <legend className="label px-1 text-ink-faint">Rights &amp; consent</legend>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input type="checkbox" name="rights" required className="mt-1 accent-[var(--color-lilac-deep)]" />
          I own or control the rights to this audio and I&rsquo;m allowed to share it here.
        </label>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-1 accent-[var(--color-lilac-deep)]" />
          {isCreator
            ? "I consent to EchoBack fingerprinting this track and surfacing short previews of it to matched artists and producers."
            : "I consent to EchoBack fingerprinting this upload so tracks can be matched to my sound. My work is never shared — only used as a reference."}
        </label>
      </fieldset>

      <SubmitButton isCreator={isCreator} />
    </form>
  );
}

function SubmitButton({ isCreator }: { isCreator: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:opacity-80"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-3">
          <span className="grad-audio block h-[3px] w-10 animate-pulse rounded-full" />
          Fingerprinting — listening for voice, style, production…
        </span>
      ) : isCreator ? (
        "Upload & run the engine"
      ) : (
        "Upload to my reference library"
      )}
    </button>
  );
}
