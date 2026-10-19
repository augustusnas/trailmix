import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { resetPageEnabled } from "@/config/flags";
import { LibraryScreen } from "./LibraryScreen";

export const metadata: Metadata = { title: "Library" };

// Checked on every visit, so the SHOW_RESET_PAGE setting decides whether the hidden reset tap works.
export const dynamic = "force-dynamic";

// Library: search, filters and pins, remembered on this phone.
export default function Library() {
  const feedbackEmail = process.env.FEEDBACK_EMAIL || undefined;
  return (
    <main className="screen" style={{ gap: 16, paddingTop: "calc(24px + var(--safe-top))" }}>
      <Gate mode="app" />
      <LibraryScreen feedbackEmail={feedbackEmail} resetEnabled={resetPageEnabled()} />
    </main>
  );
}
