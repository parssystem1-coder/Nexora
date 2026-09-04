import { describe, it, expect } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorError } from "./cursor.js";

/**
 * ADR-036 item 5's rules about the cursor itself, tested where they live —
 * the encoding is platform machinery, not a capability's behaviour, and
 * `invoice.list` will inherit exactly these guarantees.
 */
describe("ADR-036 opaque cursor", () => {
  const issued = { capabilityId: "plan.list", sortOrder: "key:asc" };

  it("round-trips the sort key it was issued for", () => {
    const cursor = encodeCursor({ ...issued, sortKey: "standard" });
    expect(decodeCursor(cursor, issued).sortKey).toBe("standard");
  });

  it("is opaque: the encoding is not the sort key in plain sight", () => {
    const cursor = encodeCursor({ ...issued, sortKey: "standard" });
    expect(cursor).not.toContain("standard");
    expect(cursor).not.toContain("plan.list");
  });

  it("rejects a cursor issued for a different capability", () => {
    const cursor = encodeCursor({ capabilityId: "invoice.list", sortOrder: "key:asc", sortKey: "x" });
    expect(() => decodeCursor(cursor, issued)).toThrow(InvalidCursorError);
  });

  it("rejects a cursor issued for a different sort order", () => {
    const cursor = encodeCursor({ capabilityId: "plan.list", sortOrder: "key:desc", sortKey: "x" });
    expect(() => decodeCursor(cursor, issued)).toThrow(InvalidCursorError);
  });

  it.each([
    ["not base64 at all", "!!!!not-a-cursor!!!!"],
    ["base64 of something that is not JSON", Buffer.from("hello", "utf8").toString("base64url")],
    ["base64 of JSON that is not an object", Buffer.from("42", "utf8").toString("base64url")],
    ["an object missing its fields", Buffer.from(JSON.stringify({ v: 1 }), "utf8").toString("base64url")],
    [
      "a cursor from an older encoding version",
      Buffer.from(JSON.stringify({ v: 0, c: "plan.list", o: "key:asc", k: "x" }), "utf8").toString("base64url"),
    ],
  ])("rejects %s", (_label, cursor) => {
    expect(() => decodeCursor(cursor, issued)).toThrow(InvalidCursorError);
  });
});
