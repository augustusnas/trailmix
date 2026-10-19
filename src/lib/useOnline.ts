"use client";

import { useSyncExternalStore } from "react";
import { TEST_SWITCH_KEY } from "./access";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function forcedOffline() {
  try {
    return sessionStorage.getItem(TEST_SWITCH_KEY) === "e10"; // beta test switch
  } catch {
    return false;
  }
}

/** True when the phone has a connection (E10). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine && !forcedOffline(), () => true);
}
