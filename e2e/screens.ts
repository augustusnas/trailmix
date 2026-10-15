// Every screen, with a routine where one is needed.
export const SCREENS = [
  { name: "welcome", path: "/" },
  { name: "listen", path: "/listen" },
  { name: "home", path: "/home" },
  { name: "library", path: "/library" },
  { name: "vibe", path: "/vibe?routine=boxing-bag-rounds" },
  { name: "mix", path: "/mix?routine=boxing-bag-rounds&energy=driven&genres=grime,dnb&length=45" },
  { name: "saved", path: "/saved?routine=boxing-bag-rounds&energy=driven&genres=grime,dnb&length=45" },
  { name: "shared", path: "/m/demo-123" },
] as const;
