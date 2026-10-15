// Music apps a mix can go to. Version one only saves playlists to YouTube Music.

import { COLORS } from "./categories";

export type MusicApp = { id: "ytm" | "spotify" | "apple"; name: string; note: string; color: string };

export const MUSIC_APPS: MusicApp[] = [
  { id: "ytm", name: "YouTube Music", note: "Saves your playlists", color: COLORS.orange },
  { id: "spotify", name: "Spotify", note: "Opens every track · saving soon", color: COLORS.lime },
  { id: "apple", name: "Apple Music", note: "Opens every track · saving soon", color: COLORS.lilac },
];
