import { describe, expect, test } from "vitest";

import { createSeededRandom, shuffled } from "./random.ts";

const ITEMS = Array.from({ length: 8 }, (_, index) => index);

describe("shuffled", () => {
  test("returns every item once", () => {
    expect([...shuffled(ITEMS, createSeededRandom(1))].sort((a, b) => a - b)).toEqual(ITEMS);
  });

  test("returns the items in an order that varies with `random`", () => {
    const orders = new Set([1, 2, 3].map((seed) => shuffled(ITEMS, createSeededRandom(seed)).join()));
    expect(orders.size).toBe(3);
  });

  test("leaves `items` in its original order", () => {
    const items = [...ITEMS];

    shuffled(items, createSeededRandom(1));

    expect(items).toEqual(ITEMS);
  });
});
