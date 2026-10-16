import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
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
      <Headline text="What’s the terrain today?" size="home" />
      <RoutinePicker pins={pins} />
    </main>
  );
}
