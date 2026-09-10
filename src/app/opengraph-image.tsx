import { ImageResponse } from "next/og";

/*
  The card people see when echoback.world is pasted into a message or a feed.
  Rendered at request time by Satori, so it stays in the brand palette
  without shipping a binary: mineral-water white, ink, and the lilac→rose
  gradient kept — as everywhere else — for the audio line alone.
*/

export const runtime = "edge";
export const alt = "EchoBack — AI music, matched to the artists it already sounds like";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 48 48" fill="none">
  <g stroke="#141719" stroke-width="3.7" stroke-linecap="round" fill="none">
    <path d="M6.03 27.7 A 22.4 22.4 0 0 1 42.17 27.7" />
    <path d="M11 32.3 A 15.2 15.2 0 0 1 37.2 32.3" />
    <path d="M14.3 36.5 A 12.1 12.1 0 0 1 33.9 36.5" />
  </g>
  <path fill="#141719" d="M19.4 16.4 C 18.95 13 19.5 9.9 21.2 9.5 C 22.9 9.15 24.2 10.1 25.6 11.3 C 27.2 12.7 28.2 14.4 30.3 17 C 26.2 16.3 22.4 15.7 19.4 16.4 Z" />
</svg>`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#eef2f1",
          padding: "72px 80px",
        }}
      >
        <img
          width={112}
          height={112}
          src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`}
          alt=""
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#141719",
              maxWidth: 900,
            }}
          >
            Your AI music already sounds like someone.
          </div>
          <div style={{ fontSize: 32, marginTop: 26, color: "#46504f", maxWidth: 820 }}>
            EchoBack finds the real artists and producers it echoes — and opens the
            conversation.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              width: 300,
              height: 5,
              borderRadius: 999,
              background: "linear-gradient(90deg, #7d63c9, #ab95e8 38%, #eba0b6 72%, #d9718f)",
            }}
          />
          <div style={{ fontSize: 26, color: "#82908e" }}>echoback.world</div>
        </div>
      </div>
    ),
    size
  );
}
