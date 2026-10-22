import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
import Link from "next/link";
import { Wordmark } from "@/components/Beta";
import { Gate } from "@/components/Gate";
import { CheckinCard } from "./CheckinCard";
import { RoutinePicker } from "./RoutinePicker";

export const metadata: Metadata = { title: "Home" };

// Home: the check-in card when one is due (F17), then the pinned routines, remembered on this phone.
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
      <CheckinCard />
      <Headline text="What’s the terrain today?" size="home" />
      <RoutinePicker />
    </main>
  );
}
