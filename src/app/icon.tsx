import { renderAppIcon } from "@/brand/AppIcon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return renderAppIcon(64);
}
