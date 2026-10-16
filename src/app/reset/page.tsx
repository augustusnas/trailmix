import type { Metadata } from "next";
import { ResetScreen } from "./ResetScreen";

export const metadata: Metadata = { title: "Reset (beta)", robots: { index: false, follow: false } };

// BETA ONLY. Reached by tapping "The library." headline 5 times quickly. Remove before launch.
export default function Reset() {
  return (
    <main className="screen">
      <ResetScreen />
    </main>
  );
}
