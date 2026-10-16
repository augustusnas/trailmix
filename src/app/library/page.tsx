import type { Metadata } from "next";
import { Gate } from "@/components/Gate";
import { LibraryScreen } from "./LibraryScreen";

export const metadata: Metadata = { title: "Library" };

// Library: search, filters and pins, remembered on this phone.
export default function Library() {
  const feedbackEmail = process.env.FEEDBACK_EMAIL || undefined;
  return (
    <main className="screen" style={{ gap: 16, paddingTop: "calc(24px + var(--safe-top))" }}>
      <Gate mode="app" />
      <LibraryScreen feedbackEmail={feedbackEmail} />
    </main>
  );
}
