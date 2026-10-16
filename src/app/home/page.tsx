import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
import Link from "next/link";
import { Wordmark } from "@/components/Beta";
import { Gate } from "@/components/Gate";
import { RoutinePicker } from "./RoutinePicker";

export const metadata: Metadata = { title: "Home" };

// Home: the pinned routines, remembered on this phone. The check-in card arrives in Milestone 5.
export default function Home() {
  return (
    <main className="screen">
      <Gate mode="app" />
      <div className="top-bar">
        <Wordmark />
        <Link href="/library" className="library-link">
          <span aria-hidden="true" className="library-dot" />
          Library
        </Link>
      </div>
      <Headline text="What’s the terrain today?" size="home" />
      <RoutinePicker />
    </main>
  );
}
