"use client";

import { useEffect, useState } from "react";
import { playlistTitle } from "@/lib/format";

/** The full YouTube playlist title, dated in the phone's own time zone. */
export function PlaylistTitle({ mix }: { mix: { name: string; routineId: string } }) {
  const [title, setTitle] = useState(() => playlistTitle(mix, new Date()));
  useEffect(() => setTitle(playlistTitle(mix, new Date())), [mix]);
  // Keep the date ("15 Oct") together on one line.
  return <span suppressHydrationWarning>{title.replace(/ (\S+)$/, "\u00a0$1")}</span>;
}
