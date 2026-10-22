"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { SIGNIN_NOTES } from "@/lib/signIn";
import { setOnboarded } from "@/lib/store";

/** Says why sign-in didn't get them in (E13 invite-only, cancelled, or sign-in not working). */
export function WelcomeNote() {
  const why = useSearchParams().get("signin");
  const note = why && why in SIGNIN_NOTES ? SIGNIN_NOTES[why as keyof typeof SIGNIN_NOTES] : null;
  useEffect(() => {
    if (why === "notInvited") setOnboarded(false); // signed out: the app starts from Welcome again
  }, [why]);
  if (!note) return null;
  return (
    <p role="alert" data-testid="signin-note" style={{ fontWeight: 700, lineHeight: 1.35 }}>
      {note}
    </p>
  );
}
