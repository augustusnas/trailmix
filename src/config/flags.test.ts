import { isOn, resetPageEnabled } from "./flags";

describe("on/off settings", () => {
  it("are off unless clearly switched on", () => {
    for (const v of [undefined, "", "off", "false", "0", "no", "maybe", "onn"]) expect(isOn(v), String(v)).toBe(false);
    for (const v of ["on", "ON", "true", "Yes", "1", " on "]) expect(isOn(v), v).toBe(true);
  });

  it("the reset page follows BETA_RESET_PAGE", () => {
    const before = process.env.BETA_RESET_PAGE;
    delete process.env.BETA_RESET_PAGE;
    expect(resetPageEnabled()).toBe(false);
    process.env.BETA_RESET_PAGE = "on";
    expect(resetPageEnabled()).toBe(true);
    if (before === undefined) delete process.env.BETA_RESET_PAGE;
    else process.env.BETA_RESET_PAGE = before;
  });
});
