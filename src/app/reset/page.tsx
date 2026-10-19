import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resetPageEnabled } from "@/config/flags";
import { ResetScreen } from "./ResetScreen";

export const metadata: Metadata = { title: "Reset (beta)", robots: { index: false, follow: false } };

// Checked on every visit, so the SHOW_RESET_PAGE setting decides (see config/flags.ts).
export const dynamic = "force-dynamic";

// BETA ONLY. Reached by tapping "The library." headline 5 times quickly, when SHOW_RESET_PAGE is on.
export default function Reset() {
  if (!resetPageEnabled()) notFound();
  return (
    <main className="screen">
      <ResetScreen />
    </main>
  );
}
