import { routineFromParams, routineHref } from "./vibeParams";

describe("routine in the web address", () => {
  it("reads the routine", () => {
    expect(routineFromParams(new URLSearchParams("routine=boxing-bag-rounds"))?.name).toBe("Boxing bag rounds");
  });

  it("rejects a missing or unknown routine instead of guessing one", () => {
    expect(routineFromParams(new URLSearchParams(""))).toBeUndefined();
    expect(routineFromParams(new URLSearchParams("routine=underwater-basket-weaving"))).toBeUndefined();
  });

  it("puts only the routine in the address", () => {
    expect(routineHref("/mix", "yoga-flow")).toBe("/mix?routine=yoga-flow");
  });
});
