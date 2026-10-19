import Link from "next/link";
import { Wordmark } from "@/components/Beta";
import { Headline } from "@/components/Headline";
import { Footer } from "./Footer";

// E16: an expired or mistyped mix link.
export default function MixMovedOn() {
  return (
    <main className="screen screen--sand" style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Wordmark />
        <Headline text="This mix has moved on." size="screen" />
        <p style={{ fontSize: "var(--t-19)", fontWeight: 700 }} data-testid="moved-on">
          Ask whoever shared it for a fresh one.
        </p>
        <Link href="/" className="cta cta--medium" style={{ background: "var(--ink)", color: "var(--lime)" }}>
          <span>What’s Trailmix?</span>
        </Link>
      </div>
      <Footer />
    </main>
  );
}
