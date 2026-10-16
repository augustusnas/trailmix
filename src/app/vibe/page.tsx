import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { VibeScreen } from "./VibeScreen";

export const metadata: Metadata = { title: "Set the vibe" };

// Set the vibe. Built entirely on the phone (works offline); the routine comes from ?routine=…
export default function Vibe() {
  return (
    <main className="screen screen--forest" style={{ paddingTop: "calc(24px + var(--safe-top))" }}>
      <Gate mode="app" />
      <Suspense>
        <VibeScreen />
      </Suspense>
    </main>
  );
}
