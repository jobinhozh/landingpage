import { describe, expect, it } from "vitest";
import sport from "../src/data/sport.json";
import travel from "../src/data/travel.json";
import { worldMap } from "../src/data/world-map.ts";

describe("travel map and sport table", () => {
  it("lists 60 countries, each with a unique code", () => {
    expect(travel).toHaveLength(60);
    expect(new Set(travel.map(([code]) => code)).size).toBe(60);
  });

  it("has a generated map with visited dots and pins for small countries (npm run map)", () => {
    expect(worldMap.land.length).toBeGreaterThan(1000);
    expect(worldMap.visited.length).toBeGreaterThan(100);
    expect(worldMap.pins.length).toBeGreaterThan(0);
    for (const [x, y] of worldMap.pins) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(worldMap.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(worldMap.height);
    }
  });

  it("keeps sport rows unique", () => {
    expect(new Set(sport.map((r) => r.id)).size).toBe(sport.length);
  });
});
