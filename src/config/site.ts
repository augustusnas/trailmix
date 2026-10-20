// App-wide settings. Change things here, not in screen code.

/** The live address. Use this wherever the app needs its own URL. */
export const SITE_URL = "https://trailmix.augustusnas.com";

/**
 * Beta labelling switch. Set to false to remove every beta label at once:
 * the BETA pill, the Welcome "INVITE-ONLY BETA" tag and the shared-page footer line.
 */
export const SHOW_BETA = true;

export const CREDIT_NAME = "Augustus Nas";
export const CREDIT_URL = "https://www.augustusnas.com";

/** Who to contact about privacy, shown on /privacy. */
export const CONTACT_EMAIL = "trailmix@augustusnas.com";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
