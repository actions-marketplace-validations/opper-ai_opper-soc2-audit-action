import { describe, it } from "node:test";
import assert from "node:assert";
import { generateReport } from "./report.ts";
import type { AgentFindings } from "./schemas.ts";

describe("generateReport", () => {
  it("generates single-repo report with findings", () => {
    const findings: AgentFindings[] = [
      {
        criteria: "Security",
        control_reference: "CC6/CC7",
        summary: "Found some issues.",
        repo: "owner/repo",
        findings: [
          {
            category: "Security",
            severity: "critical",
            title: "Hardcoded API key",
            description: "API key found in source code",
            file_path: "src/config.ts",
            recommendation: "Move to environment variable",
            soc2_reference: "CC6.1 - Logical and Physical Access Controls",
          },
        ],
      },
    ];
    const report = generateReport(["owner/repo"], findings);
    assert.ok(report.includes("# SOC2 Compliance Report"));
    assert.ok(report.includes("**Repository:** owner/repo"));
    assert.ok(report.includes("Hardcoded API key"));
    assert.ok(report.includes("Critical"));
    assert.ok(report.includes("CC6.1"));
    assert.ok(report.includes("SOC2 Ref"));
  });

  it("handles empty findings", () => {
    const findings: AgentFindings[] = [
      {
        criteria: "Security",
        control_reference: "CC6/CC7",
        summary: "No issues found.",
        repo: "owner/repo",
        findings: [],
      },
    ];
    const report = generateReport(["owner/repo"], findings);
    assert.ok(report.includes("No findings"));
  });

  it("generates multi-repo report", () => {
    const findings: AgentFindings[] = [
      {
        criteria: "Security",
        control_reference: "CC6/CC7",
        summary: "Found issues in app.",
        repo: "org/app",
        findings: [
          {
            category: "Security",
            severity: "high",
            title: "Missing auth",
            description: "No authentication on API endpoint",
            file_path: "src/api.ts",
            recommendation: "Add authentication middleware",
            soc2_reference: "CC6.1 - Logical and Physical Access Controls",
          },
        ],
      },
      {
        criteria: "Security",
        control_reference: "CC6/CC7",
        summary: "Found issues in infra.",
        repo: "org/terraform",
        findings: [
          {
            category: "Security",
            severity: "medium",
            title: "Open security group",
            description: "Security group allows all inbound traffic",
            file_path: "main.tf",
            recommendation: "Restrict inbound rules",
            soc2_reference: "CC6.6 - External Threat Protection",
          },
        ],
      },
    ];
    const report = generateReport(["org/app", "org/terraform"], findings);
    assert.ok(report.includes("**Repositories:** org/app, org/terraform"));
    assert.ok(report.includes("### org/app"));
    assert.ok(report.includes("### org/terraform"));
    assert.ok(report.includes("Missing auth"));
    assert.ok(report.includes("Open security group"));
  });
});
