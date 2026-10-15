import type { Metadata } from "next";
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
        <span className="mono" style={{ color: "var(--lime)", fontSize: "0.706rem", letterSpacing: "0.18em" }}>
          One quick thing
        </span>
      </div>
      <h1 className="headline" style={{ fontSize: "clamp(2.5rem, 13.85vw, 3.176rem)" }}>
        Where do you listen?
      </h1>
      <p style={{ fontSize: "1rem", lineHeight: 1.35 }}>
        Every mix goes straight there. You can change it any time in the library.
      </p>
      <AppPicker />
      <CtaLink href="/home" bg="var(--sand)" fg="var(--ink)">
        That’s me
      </CtaLink>
    </main>
  );
}
