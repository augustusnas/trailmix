// THE APP ICON SOURCE. Every icon size (home screen, manifest, favicon) is drawn from this one file.
//
// To swap in the real icon later: put a square PNG (at least 1024×1024) in this folder,
// e.g. src/brand/icon-final.png, and set ICON_IMAGE below to its file name. That's the only change needed.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const ICON_IMAGE: string | null = null;

const LIME = "#C8E03A";
const INK = "#16130F";

export async function renderAppIcon(size: number): Promise<ImageResponse> {
  const dir = join(process.cwd(), "src/brand");

  if (ICON_IMAGE) {
    const png = await readFile(join(dir, ICON_IMAGE));
    const src = `data:image/png;base64,${png.toString("base64")}`;
    // eslint-disable-next-line @next/next/no-img-element
    return new ImageResponse(<img src={src} width={size} height={size} alt="" />, { width: size, height: size });
  }

  // Placeholder: a Lime tile with a dark "T" in Bricolage Grotesque ExtraBold.
  // Full-bleed square: iOS and Android round the corners themselves.
  const font = await readFile(join(dir, "bricolage-800-T.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: LIME,
          color: INK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Bricolage",
          fontWeight: 800,
          fontSize: size * 0.66,
          letterSpacing: "-0.04em",
        }}
      >
        T
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] },
  );
}
