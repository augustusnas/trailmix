"use client";

import Link from "next/link";
import { useState } from "react";
import { Headline } from "@/components/Headline";
import { STORAGE_KEY, reset } from "@/lib/store";
import { TestSwitches } from "./TestSwitches";

/** Unreadable data that still says it finished first run. Exported for the E12 test. */
export const DAMAGED = '{"version":1,"onboarded":true,"pins":"oops", "vibes":[1,2';

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
      localStorage.setItem(STORAGE_KEY, DAMAGED);
      // Reload the whole app, so it reads the damaged data fresh, as when you next open it.
      window.location.replace("/home");
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
        <span>Damage the saved data and reload (E12 test)</span>
      </button>
      <p role="status" style={{ fontSize: "var(--t-17)" }}>
        {done}
      </p>
      <TestSwitches />
      <Link href="/home" className="cta cta--medium" style={{ border: "2px solid var(--sand)", color: "var(--sand)" }}>
        <span>Back to home</span>
      </Link>
    </>
  );
}
