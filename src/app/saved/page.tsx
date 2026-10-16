import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { SavedScreen } from "./SavedScreen";

export const metadata: Metadata = { title: "Saved" };

export default function Saved() {
  return (
    <main className="screen screen--lilac">
      <Gate mode="app" />
      <Suspense>
        <SavedScreen />
      </Suspense>
    </main>
  );
}
