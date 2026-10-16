"use client";

import { useEffect, useState } from "react";
import { APP_VERSION } from "@/config/site";
import { MUSIC_APPS } from "@/data/apps";
import { useSaved } from "@/lib/store";

export const FEEDBACK_SUBJECT = "Trailmix beta feedback";

export function feedbackHref(email: string, device: string, musicApp: string): string {
  const body = [
    "",
    "",
    "---",
    `App version: ${APP_VERSION}`,
    `Device: ${device}`,
    `Music app: ${musicApp}`,
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(body)}`;
}

/**
 * "Send beta feedback" pill. Opens an email to FEEDBACK_EMAIL.
 * Renders nothing when no address is set, so the Library never shows a broken button.
 */
export function FeedbackButton({ email }: { email?: string }) {
  // The device is only known in the browser, so fill it in after the page loads.
  const [device, setDevice] = useState("unknown");
  useEffect(() => setDevice(navigator.userAgent), []);
  const saved = useSaved();

  if (!email) return null;
  const musicApp = MUSIC_APPS.find((a) => a.id === saved?.musicApp)?.name ?? "not chosen";
  const href = feedbackHref(email, device, musicApp);
  return (
    <a href={href} className="feedback-btn" data-testid="feedback-button">
      Send beta feedback
    </a>
  );
}
