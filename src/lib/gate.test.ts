import { STORAGE_KEY } from "./store";
import { gateScript, isReady } from "./gate";
import { defaults } from "./store";

function run(mode: "app" | "welcome", stored: string | null) {
  const replace = vi.fn();
  const fakeStorage = { getItem: (k: string) => (k === STORAGE_KEY ? stored : null) };
  const style: Record<string, string> = {};
  new Function("localStorage", "location", "document", gateScript(mode))(fakeStorage, { replace }, { documentElement: { style } });
  return { to: replace.mock.calls[0]?.[0] as string | undefined, hidden: style.visibility === "hidden" };
}

describe("entry gate (F1, F2)", () => {
  const onboarded = JSON.stringify({ ...defaults(true) });

  it("ready means onboarded (Milestone 4 swaps this for signed in)", () => {
    expect(isReady(defaults(false))).toBe(false);
    expect(isReady(defaults(true))).toBe(true);
  });

  it("a new phone opening an app screen goes to Welcome", () => {
    expect(run("app", null)).toEqual({ to: "/", hidden: true });
  });

  it("a returning phone opening Welcome goes straight to Home, hiding Welcome first", () => {
    expect(run("welcome", onboarded)).toEqual({ to: "/home", hidden: true });
  });

  it("nobody is moved when they're in the right place", () => {
    expect(run("welcome", null).to).toBeUndefined();
    expect(run("app", onboarded).to).toBeUndefined();
  });

  it("damaged data still counts as onboarded if it says so (E12), and never throws", () => {
    expect(run("welcome", '{"version":7,"onboarded":true}').to).toBe("/home");
    expect(run("welcome", "{not json").to).toBeUndefined();
    expect(run("welcome", '{"version":1,"onboarded":true,"pins":"oo').to).toBe("/home");
  });
});
