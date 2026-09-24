import { describe, expect, it } from "vitest";
import { buildReceivedPayload, initialReceived, receptionSummary } from "./reception";

const lines = [
  { id: "a", quantity: 8, excluded: false },
  { id: "b", quantity: 3, excluded: false },
  { id: "c", quantity: 5, excluded: true },
];

describe("purchase order reception", () => {
  it("starts every ordered line at the ordered quantity and skips removed lines", () => {
    expect(initialReceived(lines)).toEqual({ a: "8", b: "3" });
  });

  it("sends one entry per ordered line, zero meaning not delivered", () => {
    expect(buildReceivedPayload(lines, { a: "6", b: "0" })).toEqual({
      entries: [
        { item_id: "a", received_quantity: 6 },
        { item_id: "b", received_quantity: 0 },
      ],
    });
  });

  it("refuses a missing, negative or decimal quantity", () => {
    expect(buildReceivedPayload(lines, { a: "6" })).toEqual({ error: "invalid_quantity" });
    expect(buildReceivedPayload(lines, { a: "-1", b: "3" })).toEqual({ error: "invalid_quantity" });
    expect(buildReceivedPayload(lines, { a: "2.5", b: "3" })).toEqual({ error: "invalid_quantity" });
    expect(buildReceivedPayload(lines, { a: " ", b: "3" })).toEqual({ error: "invalid_quantity" });
  });

  it("counts the units entering the stock and the lines delivered short or over", () => {
    const entries = [
      { item_id: "a", received_quantity: 6 },
      { item_id: "b", received_quantity: 4 },
    ];
    expect(receptionSummary(lines, entries)).toEqual({ units: 10, shortLines: 1, overLines: 1 });
  });

  it("reports a complete delivery as neither short nor over", () => {
    const entries = [
      { item_id: "a", received_quantity: 8 },
      { item_id: "b", received_quantity: 3 },
    ];
    expect(receptionSummary(lines, entries)).toEqual({ units: 11, shortLines: 0, overLines: 0 });
  });
});
