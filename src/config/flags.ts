// On/off settings read from environment variables (server only). Off unless set.

/** "on", "true", "yes" or "1" (any case) mean on; anything else, or not set, means off. */
export function isOn(value: string | undefined): boolean {
  return /^(on|true|yes|1)$/i.test((value ?? "").trim());
}

/**
 * SHOW_RESET_PAGE=true: the beta reset page (/reset) and its hidden way in
 * (tapping "The library." 5 times). Switch off before sending beta invites.
 */
export function resetPageEnabled(): boolean {
  return isOn(process.env.SHOW_RESET_PAGE);
}
