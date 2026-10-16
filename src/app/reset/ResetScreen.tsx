"use client";

import Link from "next/link";
import { useState } from "react";
import { Headline } from "@/components/Headline";
import { STORAGE_KEY, reset } from "@/lib/store";

export function ResetScreen() {
  const [done, setDone] = useState("");

  const freshInstall = () => {
    reset();
    // A full page load, so everything starts again as on a new phone.
    window.location.replace("/");
  };

  const damage = () => {
    try {
      // Unreadable data, but marked as onboarded: E12 says the app should quietly recover
      // to the defaults and still skip Welcome.
      localStorage.setItem(STORAGE_KEY, '{"version":1,"onboarded":true,"pins":"oops", "vibes":[1,2');
      setDone("Saved data is now damaged. Open Home to check the app recovers.");
    } catch {
      setDone("This phone won't let Trailmix save anything, so there's nothing to damage.");
    }
  };

  return (
    <>
      <p className="mono" style={{ color: "var(--lime)" }}>
        Beta tools
      </p>
      <Headline text="Reset this phone." size="screen" />
      <p style={{ fontSize: "var(--t-17)" }}>
        Only affects Trailmix on this phone. The home-screen app and Safari keep separate copies.
      </p>
      <button type="button" className="cta cta--large" style={{ background: "var(--orange)", color: "var(--ink)" }} onClick={freshInstall}>
        <span>Reset to a fresh install</span>
      </button>
      <button type="button" className="cta cta--medium" style={{ background: "var(--sand)", color: "var(--ink)" }} onClick={damage}>
        <span>Damage the saved data (E12 test)</span>
      </button>
      <p role="status" style={{ fontSize: "var(--t-17)" }}>
        {done}
      </p>
      <Link href="/home" className="cta cta--medium" style={{ border: "2px solid var(--sand)", color: "var(--sand)" }}>
        <span>Back to home</span>
      </Link>
    </>
  );
}
