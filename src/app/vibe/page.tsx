import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { VibeScreen } from "./VibeScreen";

export const metadata: Metadata = { title: "Set the vibe" };

// Set the vibe: three steps, one question each. Built entirely on the phone (works offline); the
// routine comes from ?routine=… (and &from=library when opened from the Library, for Back).
export default function Vibe() {
  return (
    <>
      <Gate mode="app" />
      <Suspense fallback={<main className="screen screen--lime" />}>
        <VibeScreen />
      </Suspense>
    </>
  );
}
