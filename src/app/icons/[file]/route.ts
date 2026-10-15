import { renderAppIcon } from "@/brand/AppIcon";

// Manifest icons: /icons/icon-192.png, /icons/icon-512.png, /icons/maskable-512.png …
const ICON_SIZES = [120, 152, 167, 180, 192, 512] as const;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [...ICON_SIZES.map((s) => ({ file: `icon-${s}.png` })), { file: "maskable-512.png" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = Number(file.match(/(\d+)\.png$/)?.[1]);
  return renderAppIcon(size);
}
