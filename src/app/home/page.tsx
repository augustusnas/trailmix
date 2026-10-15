import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Beta";
import { DEFAULT_PINS, getRoutine, type Routine } from "@/data/routines";
import { RoutinePicker } from "./RoutinePicker";

export const metadata: Metadata = { title: "Home" };

// Home. Real pinning arrives in Milestone 2; the check-in card in Milestone 5.
export default function Home() {
  const pins = DEFAULT_PINS.map((id) => getRoutine(id)).filter((r): r is Routine => Boolean(r));
  return (
    <main className="screen">
      <div className="top-bar">
        <Wordmark />
        <Link href="/library" className="library-link">
          <span aria-hidden="true" className="library-dot" />
          Library
        </Link>
      </div>
      <h1 className="headline" style={{ fontSize: "clamp(2.2rem, 11.8vw, 2.706rem)" }}>
        What’s the terrain today?
      </h1>
      <RoutinePicker pins={pins} />
    </main>
  );
}
