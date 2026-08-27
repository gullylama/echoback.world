import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { uploadTrackAction } from "@/app/actions";
import { demoMode } from "@/lib/config";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload" };

export default async function UploadPage() {
  const user = await currentUser();
  if (!user) redirect("/start");

  const copy =
    user.role === "creator"
      ? {
          kicker: "New demo",
          title: "Send an echo",
          body: "Upload the demo as it is — sketch quality is fine. The engine listens for voice, style, and production separately, then returns the real people it resembles.",
          titleLabel: "Demo title",
          placeholder: "e.g. Midnight Arithmetic",
        }
      : user.role === "artist"
        ? {
            kicker: "Reference upload",
            title: "Seed your voice",
            body: "Upload songs that represent how you actually sound — your register, your delivery. This is what demos will be matched against.",
            titleLabel: "Upload title",
            placeholder: "e.g. Voice reference — 3 songs",
          }
        : {
            kicker: "Reference upload",
            title: "Seed your sound",
            body: "Upload production work that defines your sound — the drums, the texture, the space. Demos are matched on production, independent of vocals.",
            titleLabel: "Upload title",
            placeholder: "e.g. Production reel — 4 cuts",
          };

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <p className="label text-ink-faint">{copy.kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{copy.title}</h1>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{copy.body}</p>

      <UploadForm
        action={uploadTrackAction}
        titleLabel={copy.titleLabel}
        placeholder={copy.placeholder}
        demoMode={demoMode}
        isCreator={user.role === "creator"}
      />
    </div>
  );
}
