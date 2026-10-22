// Who goes where on opening the app.
//
// "Ready" means this phone finished first run (Sign in with Google → Where do you listen). Whether
// the sign-in is still good is checked by the server on every request; when it isn't, the screen
// that asked offers a quick sign-in (E7), and an account off the guest list goes back to Welcome (E13).
// Welcome with a sign-in note (/?signin=…) always shows, so the note can be read.

import { ONBOARDED_MARK, STORAGE_KEY, type Saved } from "./store";

export function isReady(s: Saved): boolean {
  return s.onboarded;
}

export type GateMode = "app" | "welcome";

/** Where a screen sends you if you don't belong there yet. */
export const GATE_TARGET: Record<GateMode, string> = {
  app: "/", // app screens: not ready yet → Welcome
  welcome: "/home", // Welcome and Where do you listen: already ready → Home
};

/**
 * Runs before anything is drawn, so a returning user never sees Welcome flash (F2).
 * Mirrors isReady(): reads the same record and the same field.
 */
export function gateScript(mode: GateMode): string {
  const wantReady = mode === "app";
  const note = mode === "welcome" ? `if(/[?&]signin=/.test(location.search))return;` : "";
  return `(function(){${note}var r=false,t=null;try{t=localStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
  )});var d=JSON.parse(t||"null");r=!!(d&&d.onboarded===true)}catch(e){r=${ONBOARDED_MARK}.test(t||"")}if(r!==${wantReady}){document.documentElement.style.visibility="hidden";location.replace(${JSON.stringify(
    GATE_TARGET[mode],
  )})}})();`;
}
