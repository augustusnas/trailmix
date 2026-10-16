import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
import { CtaLink } from "@/components/CtaLink";
import { Wordmark } from "@/components/Beta";
import { AppPicker } from "./AppPicker";

export const metadata: Metadata = { title: "Where do you listen" };

// Where do you listen. Remembering the choice arrives in Milestone 2.
export default function Listen() {
  return (
    <main className="screen">
      <div className="top-bar">
        <Wordmark />
        <span className="mono" style={{ color: "var(--lime)", fontSize: "var(--t-mono-12)", letterSpacing: "0.18em" }}>
          One quick thing
        </span>
      </div>
      <Headline text="Where do you listen?" size="listen" />
      <p style={{ fontSize: "var(--t-17)", lineHeight: 1.35 }}>
        Every mix goes straight there. You can change it any time in the library.
      </p>
      <AppPicker />
      <CtaLink href="/home" bg="var(--sand)" fg="var(--ink)">
        That’s me
      </CtaLink>
    </main>
  );
}
