// Music apps a mix can go to. Version one only saves playlists to YouTube Music.

import { COLORS } from "./categories";

export type MusicApp = {
  id: "ytm" | "spotify" | "apple";
  name: string;
  note: string;
  color: string;
  /** Main button on The mix */
  mixAction: string;
  /** Main button on Saved */
  openAction: string;
  homeUrl: string;
  /** FAKE until Milestone 3: a search for the track in this app. */
  trackUrl: (artist: string, title: string) => string;
};

const q = (artist: string, title: string) => encodeURIComponent(`${artist} ${title}`);

export const MUSIC_APPS: MusicApp[] = [
  {
    id: "ytm",
    name: "YouTube Music",
    note: "Saves your playlists",
    color: COLORS.orange,
    mixAction: "Keep it in YouTube Music",
    openAction: "Open in YouTube Music",
    homeUrl: "https://music.youtube.com/",
    trackUrl: (a, t) => `https://music.youtube.com/search?q=${q(a, t)}`,
  },
  {
    id: "spotify",
    name: "Spotify",
    note: "Opens every track · saving soon",
    color: COLORS.lime,
    mixAction: "Open in Spotify",
    openAction: "Open in Spotify",
    homeUrl: "https://open.spotify.com/",
    trackUrl: (a, t) => `https://open.spotify.com/search/${q(a, t)}`,
  },
  {
    id: "apple",
    name: "Apple Music",
    note: "Opens every track · saving soon",
    color: COLORS.lilac,
    mixAction: "Open in Apple Music",
    openAction: "Open in Apple Music",
    homeUrl: "https://music.apple.com/",
    trackUrl: (a, t) => `https://music.apple.com/search?term=${q(a, t)}`,
  },
];

/** The saved app, or YouTube Music when none is chosen yet (the only app that saves in version one). */
export function appOrDefault(id: string | null | undefined): MusicApp {
  return MUSIC_APPS.find((a) => a.id === id) ?? MUSIC_APPS[0];
}
