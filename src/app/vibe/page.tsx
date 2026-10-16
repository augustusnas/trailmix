import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/CtaLink";
import { RoutineTag } from "@/components/RoutineTag";
import { parseVibe, type SearchParams } from "@/lib/vibeParams";
import { VibePicker } from "./VibePicker";

export const metadata: Metadata = { title: "Set the vibe" };

// Set the vibe. Remembering settings per routine arrives in Milestone 2.
export default async function Vibe({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const vibe = parseVibe(await searchParams);
  if (!vibe) redirect("/home");

  return (
    <main className="screen screen--forest" style={{ paddingTop: "calc(24px + var(--safe-top))" }}>
      <div className="top-bar">
        <BackLink href="/home" label="Back to routines" color="var(--sand)" />
        <RoutineTag routine={vibe.routine} />
      </div>
      <Headline text="Set the vibe." size="screen" />
      <VibePicker initial={vibe} />
    </main>
  );
}
