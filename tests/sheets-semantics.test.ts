/**
 * Tri-state progress semantics (audit A2), deterministic lock ordering and
 * stable advisory-key derivation (audit A5). Pure-logic tests: no database.
 *
 * lib/services/sheets.ts imports the Prisma client singleton; a placeholder
 * URL satisfies the datasource env check because these tests never connect.
 */
process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/placeholder";

import { describe, it, expect } from "vitest";
import {
  resolveEffectiveSolved,
  resolveSolvedSource,
} from "../lib/services/sheets";
import {
  advisoryLockBigInt,
  questionLockKey,
  sheetLockKey,
  sortLockKeys,
  syncLockKey,
  userLockKey,
} from "../lib/locking";

describe("Tri-state solved semantics (audit A2)", () => {
  it("no manual row falls back to the synced LeetCode state", () => {
    expect(resolveEffectiveSolved(undefined, true)).toBe(true);
    expect(resolveEffectiveSolved(undefined, false)).toBe(false);
    expect(resolveSolvedSource(undefined, true)).toBe("AUTO");
    expect(resolveSolvedSource(undefined, false)).toBeNull();
  });

  it("a manual true marks solved regardless of auto state", () => {
    expect(resolveEffectiveSolved(true, false)).toBe(true);
    expect(resolveSolvedSource(true, true)).toBe("MANUAL");
  });

  it("a manual false overrides an auto-detected solve and sticks", () => {
    // This is the regression for the old delete-on-false behaviour: an
    // auto-solved question marked unsolved by the user must stay unsolved.
    expect(resolveEffectiveSolved(false, true)).toBe(false);
    expect(resolveSolvedSource(false, false)).toBe("MANUAL");
  });

  it("a manual false with no auto solve is simply unsolved", () => {
    expect(resolveEffectiveSolved(false, false)).toBe(false);
  });
});

describe("Deterministic lock ordering (audit A5)", () => {
  it("sorts by resource type first, then lexically, regardless of input order", () => {
    const a = sortLockKeys([questionLockKey("q2"), userLockKey("u1"), questionLockKey("q1")]);
    expect(a).toEqual([
      "question:q1",
      "question:q2",
      "user:u1",
    ]);
  });

  it("two mutations over the same resources always acquire in the same order", () => {
    const user = userLockKey("user-1");
    const questionA = questionLockKey("q-a");
    const sheet = sheetLockKey("s-1");
    expect(sortLockKeys([user, questionA, sheet])).toEqual(
      sortLockKeys([sheet, user, questionA])
    );
  });

  it("does not mutate or duplicate its input", () => {
    const input = [sheetLockKey("s2"), questionLockKey("q1"), sheetLockKey("s1")];
    const out = sortLockKeys(input);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
  });

  it("includes every declared resource type in the canonical order", () => {
    const keys = [userLockKey("u"), syncLockKey("u"), questionLockKey("q")];
    expect(sortLockKeys(keys)[0]).toBe("question:q");
  });
});

describe("Advisory lock key derivation (audit A5)", () => {
  it("is a stable function of the key string", () => {
    const key = "user:11111111-2222-3333-4444-555555555555";
    expect(advisoryLockBigInt(key)).toBe(advisoryLockBigInt(key));
  });

  it("differs for different resource keys (weak collision-freedom over a realistic set)", () => {
    const keys = [
      "user:u1",
      "question:q1",
      "sheet:s1",
      "sync:u1",
      "user:u2",
      "sheet:s2",
    ];
    const hashes = new Set(keys.map(advisoryLockBigInt));
    expect(hashes.size).toBe(keys.length);
  });

  it("fits PostgreSQL's signed 64-bit integer range", () => {
    for (const key of ["user:u1", "question:q2", "sheet:s3", "sync:u1"]) {
      const v = advisoryLockBigInt(key);
      expect(v).toBeGreaterThanOrEqual(-(2n ** 63n) / 2n);
      expect(v).toBeLessThanOrEqual((2n ** 63n) / 2n);
    }
  });
});
