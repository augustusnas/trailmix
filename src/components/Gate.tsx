"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GATE_TARGET, gateScript, isReady, type GateMode } from "@/lib/gate";
import { useSaved } from "@/lib/store";

/**
 * Put first on a screen. The inline script handles a fresh page load before anything shows;
 * the effect covers moving between screens inside the app.
 */
export function Gate({ mode }: { mode: GateMode }) {
  const saved = useSaved();
  const router = useRouter();
  useEffect(() => {
    if (!saved) return;
    const ready = isReady(saved);
    if (mode === "welcome" && /[?&]signin=/.test(location.search)) return; // let the sign-in note be read
    if ((mode === "app" && !ready) || (mode === "welcome" && ready)) router.replace(GATE_TARGET[mode]);
  }, [saved, mode, router]);
  return <script dangerouslySetInnerHTML={{ __html: gateScript(mode) }} />;
}
