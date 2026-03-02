import { describe, it } from "node:test";
import assert from "node:assert";
import { computeStats, formatStats } from "./stats.ts";
import type { AgentFindings } from "./schemas.ts";

const makeFindings = (repo: string, severities: string[]): AgentFindings => ({
  criteria: "Security",
  control_reference: "CC6/CC7",
  summary: "Test summary",
  repo,
  findings: severities.map((severity, i) => ({
    category: "Security",
    severity: severity as AgentFindings["findings"][number]["severity"],
    title: `Finding ${i}`,
    description: "Description",
    file_path: null,
    recommendation: "Fix it",
    soc2_reference: "CC6.1",
  })),
});

describe("computeStats", () => {
  it("counts severity correctly for a single repo", () => {
    const findings = [makeFindings("org/repo", ["critical", "high", "high", "medium", "low", "info"])];
    const stats = computeStats(["org/repo"], findings);
    assert.strictEqual(stats.totalFindings, 6);
    assert.strictEqual(stats.severityCounts.critical, 1);
    assert.strictEqual(stats.severityCounts.high, 2);
    assert.strictEqual(stats.severityCounts.medium, 1);
    assert.strictEqual(stats.severityCounts.low, 1);
    assert.strictEqual(stats.severityCounts.info, 1);
    assert.strictEqual(stats.reposAudited, 1);
  });

  it("sets riskLevel to Critical when critical findings exist", () => {
    const findings = [makeFindings("org/repo", ["critical", "high"])];
    const stats = computeStats(["org/repo"], findings);
    assert.strictEqual(stats.riskLevel, "Critical");
  });

  it("sets riskLevel to High when no critical but high findings exist", () => {
    const findings = [makeFindings("org/repo", ["high", "medium"])];
    const stats = computeStats(["org/repo"], findings);
    assert.strictEqual(stats.riskLevel, "High");
  });

  it("sets riskLevel to Medium when only medium/low/info findings", () => {
    const findings = [makeFindings("org/repo", ["medium", "low"])];
    const stats = computeStats(["org/repo"], findings);
    assert.strictEqual(stats.riskLevel, "Medium");
  });

  it("sets riskLevel to Low when no findings", () => {
    const stats = computeStats(["org/repo"], []);
    assert.strictEqual(stats.riskLevel, "Low");
    assert.strictEqual(stats.totalFindings, 0);
  });

  it("aggregates findings across multiple repos", () => {
    const findings = [
      makeFindings("org/repo1", ["critical"]),
      makeFindings("org/repo2", ["high", "medium"]),
    ];
    const stats = computeStats(["org/repo1", "org/repo2"], findings);
    assert.strictEqual(stats.reposAudited, 2);
    assert.strictEqual(stats.totalFindings, 3);
    assert.strictEqual(stats.repoBreakdown.length, 2);
  });

  it("tracks categoriesChecked correctly", () => {
    const findings: AgentFindings[] = [
      { ...makeFindings("org/repo", ["high"]), criteria: "Security" },
      { ...makeFindings("org/repo", ["low"]), criteria: "Availability" },
      { ...makeFindings("org/repo", []), criteria: "Privacy" },
    ];
    const stats = computeStats(["org/repo"], findings);
    assert.strictEqual(stats.categoriesChecked, 3);
  });
});

describe("formatStats", () => {
  it("includes all expected sections", () => {
    const findings = [makeFindings("org/repo", ["critical", "high"])];
    const stats = computeStats(["org/repo"], findings);
    const output = formatStats(stats);
    assert.ok(output.includes("## Audit Stats"));
    assert.ok(output.includes("Repos audited"));
    assert.ok(output.includes("Risk level"));
    assert.ok(output.includes("Findings by Severity"));
    assert.ok(output.includes("Critical"));
    assert.ok(output.includes("High"));
  });

  it("omits zero-count severities", () => {
    const findings = [makeFindings("org/repo", ["critical"])];
    const stats = computeStats(["org/repo"], findings);
    const output = formatStats(stats);
    assert.ok(output.includes("Critical"));
    assert.ok(!output.includes("| Low |"));
    assert.ok(!output.includes("| Info |"));
  });

  it("includes repo breakdown for multi-repo audits", () => {
    const findings = [
      makeFindings("org/repo1", ["high"]),
      makeFindings("org/repo2", ["medium"]),
    ];
    const stats = computeStats(["org/repo1", "org/repo2"], findings);
    const output = formatStats(stats);
    assert.ok(output.includes("Findings by Repository"));
    assert.ok(output.includes("org/repo1"));
    assert.ok(output.includes("org/repo2"));
  });

  it("omits repo breakdown for single-repo audits", () => {
    const findings = [makeFindings("org/repo", ["high"])];
    const stats = computeStats(["org/repo"], findings);
    const output = formatStats(stats);
    assert.ok(!output.includes("Findings by Repository"));
  });
});
