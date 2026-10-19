import { isOn, resetPageEnabled } from "./flags";

describe("on/off settings", () => {
  it("are off unless clearly switched on", () => {
    for (const v of [undefined, "", "off", "false", "0", "no", "maybe", "onn"]) expect(isOn(v), String(v)).toBe(false);
    for (const v of ["on", "ON", "true", "Yes", "1", " on "]) expect(isOn(v), v).toBe(true);
  });

  it("the reset page follows SHOW_RESET_PAGE", () => {
    const before = process.env.SHOW_RESET_PAGE;
    delete process.env.SHOW_RESET_PAGE;
    expect(resetPageEnabled()).toBe(false);
    process.env.SHOW_RESET_PAGE = "true";
    expect(resetPageEnabled()).toBe(true);
    if (before === undefined) delete process.env.SHOW_RESET_PAGE;
    else process.env.SHOW_RESET_PAGE = before;
  });
});
