import { describe, it, expect } from "vitest";
import { checkNumericFidelity } from "../check-numeric-fidelity";

describe("checkNumericFidelity", () => {
  it("passes when all numbers match exactly", () => {
    const original = "Increased revenue by 40% and managed a team of 12.";
    const curated = "Increased revenue by 40% and managed a team of 12.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("flags changed percentage", () => {
    const original = "Improved performance by 40%.";
    const curated = "Improved performance by 50%.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]).toContain("40%");
  });

  it("flags missing dollar amount", () => {
    const original = "Managed a $2M budget.";
    const curated = "Managed a large budget.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes("$2M") || m.includes("2M"))).toBe(true);
  });

  it("flags changed headcount", () => {
    const original = "Led a team of 12 engineers.";
    const curated = "Led a team of 15 engineers.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(false);
    expect(result.mismatches[0]).toContain("12");
  });

  it("does not flag 4-digit years", () => {
    const original = "Graduated in 2019 and promoted in 2022.";
    const curated = "Graduated in 2019. Promoted in 2022.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("treats 5,000 as equivalent to 5000 (comma normalization)", () => {
    const original = "Processed 5,000 transactions per day.";
    const curated = "Processed 5000 transactions per day.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("expands K suffix: $2K matches $2000", () => {
    const original = "Saved $2K per month.";
    const curated = "Saved $2000 per month.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("expands M suffix: $2M matches $2,000,000", () => {
    const original = "Managed a $2M budget.";
    const curated = "Managed a $2,000,000 budget.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("is unaffected by **bold** markers around numbers", () => {
    const original = "Achieved **40%** improvement.";
    const curated = "Achieved 40% improvement.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("is unaffected by __curated__ markers around numbers", () => {
    const original = "Improved speed by 40%.";
    const curated = "Improved speed by __40%__.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("passes on a resume with no numbers", () => {
    const original = "Experienced software engineer with leadership skills.";
    const curated = "Seasoned software engineer with strong leadership.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("mismatch message is human-readable and includes the original token", () => {
    const original = "Increased efficiency by 30%.";
    const curated = "Increased efficiency by 45%.";
    const result = checkNumericFidelity(original, curated);
    expect(result.mismatches[0]).toMatch(/30%/);
    expect(result.mismatches[0]).toMatch(/original resume/i);
  });

  it("does not report duplicate mismatches for the same value", () => {
    const original = "Saved 40% on costs and improved quality by 40%.";
    const curated = "Improved quality significantly.";
    const result = checkNumericFidelity(original, curated);
    // 40% appears twice in original but should only produce one mismatch
    expect(result.mismatches.filter((m) => m.includes("40%"))).toHaveLength(1);
  });

  // Regression tests for bidirectional value-based comparison (bug: original direction only)
  it("REGRESSION: original 15,000 matches curated 15K (comma vs K suffix)", () => {
    const original = "Handled 15,000 support tickets annually.";
    const curated = "Handled 15K support tickets annually.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("REGRESSION: original 15K matches curated 15,000 (K suffix vs comma)", () => {
    const original = "Handled 15K support tickets annually.";
    const curated = "Handled 15,000 support tickets annually.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("REGRESSION: original $2M matches curated $2,000,000 (M suffix vs full number)", () => {
    const original = "Grew revenue from $0 to $2M in two years.";
    const curated = "Grew revenue from $0 to $2,000,000 in two years.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("REGRESSION: still flags when K-notation value actually changes (15K → 20K)", () => {
    const original = "Managed 15K daily active users.";
    const curated = "Managed 20K daily active users.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes("15K") || m.includes("15000"))).toBe(true);
  });

  it("REGRESSION: mixed notation — original 5,000 TPS, curated 5K TPS both pass", () => {
    const original = "Architected a system processing 5,000 TPS with 99.9% uptime.";
    const curated = "Architected a system processing 5K TPS with 99.9% uptime.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  // Regression tests for MM (financial double-M notation = million)
  it("REGRESSION: $3MM in original matches $3MM in curated (no false mismatch)", () => {
    const original = "Closed $3MM in enterprise deals.";
    const curated = "Closed $3MM in enterprise deals.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it("REGRESSION: $3MM in original matches $3M in curated (MM = M = 3 million)", () => {
    const original = "Managed a $3MM budget.";
    const curated = "Managed a $3M budget.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("REGRESSION: $3MM in original matches $3,000,000 in curated", () => {
    const original = "Raised $3MM in Series A funding.";
    const curated = "Raised $3,000,000 in Series A funding.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("REGRESSION: $3M in original matches $3MM in curated", () => {
    const original = "Drove $3M in annual recurring revenue.";
    const curated = "Drove $3MM in annual recurring revenue.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(true);
  });

  it("REGRESSION: flags genuine $3MM → $5MM change as hallucination", () => {
    const original = "Closed $3MM in enterprise deals.";
    const curated = "Closed $5MM in enterprise deals.";
    const result = checkNumericFidelity(original, curated);
    expect(result.passed).toBe(false);
    expect(result.mismatches.some((m) => m.includes("3MM") || m.includes("3M"))).toBe(true);
  });
});
