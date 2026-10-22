// Shared by the app's screens and the server-drawn Welcome.

/** Where "Sign in with Google" goes, coming back to `returnTo` afterwards. `youtube`: ask for the YouTube permission too. */
export const signInHref = (returnTo: string, youtube = false) =>
  `/api/auth/signin/google?${new URLSearchParams({ returnTo, ...(youtube ? { youtube: "1" } : {}) })}`;

/** Why Welcome was opened after a sign-in (`/?signin=…`), and what it says. */
export const SIGNIN_NOTES = {
  notInvited: "Trailmix is invite-only for now, and that Google account isn't on the guest list. Try the account you were invited with, or ask whoever invited you.",
  cancelled: "Sign-in didn't finish. Try again when you're ready.",
  unavailable: "Sign-in isn't working right now. Try again later.",
} as const;
