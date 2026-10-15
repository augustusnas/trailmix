"use client";

import { useEffect, useState } from "react";
import { shortDate } from "@/data/fakeMix";

/** Today's date as "15 Oct", using the phone's own time zone. */
export function TodayDate({ upper = false }: { upper?: boolean }) {
  const [label, setLabel] = useState(() => shortDate(new Date()));
  useEffect(() => setLabel(shortDate(new Date())), []);
  return <span suppressHydrationWarning>{upper ? label.toUpperCase() : label}</span>;
}
