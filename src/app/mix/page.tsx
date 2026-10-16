import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { MixScreen } from "./MixScreen";

export const metadata: Metadata = { title: "Your mix" };

// The mix. Built on the phone from ?routine=… and that routine's saved vibe (works offline).
export default function Mix() {
  return (
    <main className="screen screen--sand screen--flush">
      <Gate mode="app" />
      <Suspense>
        <MixScreen />
      </Suspense>
    </main>
  );
}
