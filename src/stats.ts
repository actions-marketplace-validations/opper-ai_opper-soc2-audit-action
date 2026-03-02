import type { AgentFindings, Severity } from "./schemas.ts";

export interface AuditStats {
  reposAudited: number;
  categoriesChecked: number;
  totalFindings: number;
  severityCounts: Record<Severity, number>;
  riskLevel: string;
  categoryBreakdown: { category: string; count: number }[];
  repoBreakdown: { repo: string; count: number }[];
}

export function computeStats(repos: string[], allFindings: AgentFindings[]): AuditStats {
  const severityCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const af of allFindings) {
    for (const f of af.findings) {
      severityCounts[f.severity]++;
    }
  }

  const totalFindings = Object.values(severityCounts).reduce((a, b) => a + b, 0);

  let riskLevel = "Low";
  if (severityCounts.critical > 0) riskLevel = "Critical";
  else if (severityCounts.high > 0) riskLevel = "High";
  else if (severityCounts.medium > 0) riskLevel = "Medium";

  const categoryCounts = new Map<string, number>();
  for (const af of allFindings) {
    const existing = categoryCounts.get(af.criteria) ?? 0;
    categoryCounts.set(af.criteria, existing + af.findings.length);
  }

  const categoryBreakdown = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const repoCounts = new Map<string, number>();
  for (const af of allFindings) {
    const repo = af.repo ?? repos[0];
    const existing = repoCounts.get(repo) ?? 0;
    repoCounts.set(repo, existing + af.findings.length);
  }

  const repoBreakdown = [...repoCounts.entries()]
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count);

  return {
    reposAudited: repos.length,
    categoriesChecked: categoryCounts.size,
    totalFindings,
    severityCounts,
    riskLevel,
    categoryBreakdown,
    repoBreakdown,
  };
}

export function formatStats(stats: AuditStats): string {
  const lines: string[] = [
    "",
    "---",
    "## Audit Stats",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Repos audited | ${stats.reposAudited} |`,
    `| Categories checked | ${stats.categoriesChecked} |`,
    `| Total findings | ${stats.totalFindings} |`,
    `| Risk level | **${stats.riskLevel}** |`,
    "",
    "### Findings by Severity",
    "",
    "| Severity | Count |",
    "|----------|-------|",
  ];

  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const count = stats.severityCounts[sev];
    if (count > 0) {
      lines.push(`| ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${count} |`);
    }
  }

  if (stats.categoryBreakdown.length > 0) {
    lines.push("");
    lines.push("### Findings by Category");
    lines.push("");
    lines.push("| Category | Findings |");
    lines.push("|----------|----------|");
    for (const { category, count } of stats.categoryBreakdown) {
      lines.push(`| ${category} | ${count} |`);
    }
  }

  if (stats.repoBreakdown.length > 1) {
    lines.push("");
    lines.push("### Findings by Repository");
    lines.push("");
    lines.push("| Repository | Findings |");
    lines.push("|------------|----------|");
    for (const { repo, count } of stats.repoBreakdown) {
      lines.push(`| ${repo} | ${count} |`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
