"use client";

import { SITE_URL } from "@/config/site";
import { report } from "./usage";

export const shareUrl = (id: string) => `${SITE_URL}/m/${id}`;

/** F15: the iPhone share sheet with the mix page link; copies the link where there's no share sheet. */
export async function shareLink(id: string, name: string): Promise<"shared" | "copied" | "cancelled"> {
  const url = shareUrl(id);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${name}: a Trailmix`, url });
      report({ event: "shared" });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    report({ event: "shared" });
    return "copied";
  } catch {
    return "cancelled";
  }
}
