import { CONTACT_EMAIL } from "./site";

/** The contact email on Privacy and Terms: CONTACT_EMAIL in Vercel, or the default in site.ts. Server pages only. */
export const contactEmail = () => process.env.CONTACT_EMAIL?.trim() || CONTACT_EMAIL;
