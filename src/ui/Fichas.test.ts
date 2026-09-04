import { describe, it, expect } from "vitest";
import { descomponer } from "./Fichas";

describe("descomponer en fichas", () => {
  it("usa las denominaciones grandes primero", () => {
    expect(descomponer(130)).toEqual([{ v: 100, n: 1 }, { v: 25, n: 1 }, { v: 5, n: 1 }]);
  });
  it("un monto chico usa fichas chicas", () => {
    expect(descomponer(3)).toEqual([{ v: 1, n: 3 }]);
  });
  it("cero no da fichas", () => {
    expect(descomponer(0)).toEqual([]);
  });
  it("respeta el tope de denominaciones", () => {
    expect(descomponer(1131, 2).length).toBe(2);
  });
  it("redondea montos con decimales", () => {
    expect(descomponer(24.6)).toEqual([{ v: 25, n: 1 }]);
  });
});
