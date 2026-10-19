"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccessCodeForm } from "@/components/AccessCodeForm";
import { Icon } from "@/components/Icon";
import { useSaved } from "@/lib/store";

/**
 * "Lace up": stands in for sign-in until Milestone 4. The first time, it asks for the beta access
 * code (once per phone), then carries on to Where do you listen.
 */
export function LaceUp() {
  const router = useRouter();
  const saved = useSaved();
  const [asking, setAsking] = useState(false);

  if (asking) return <AccessCodeForm onDone={() => router.push("/listen")} />;
  return (
    <button
      type="button"
      className="cta cta--large"
      style={{ background: "var(--ink)", color: "var(--lime)" }}
      onClick={() => (saved?.accessCode ? router.push("/listen") : setAsking(true))}
    >
      <span>Lace up</span>
      <Icon name="arrowRight" />
    </button>
  );
}
