import { appendFileSync, writeFileSync } from "fs";
import { join } from "node:path";
import { parseRepoArg } from "./tools.ts";
import { runAudit } from "./coordinator.ts";
import { generateReport } from "./report.ts";
import { computeStats, formatStats } from "./stats.ts";
import type { AgentFindings } from "./schemas.ts";

async function main() {
  // Support VALIDATED_REPOS env var (set by action.yml) or CLI args for local use
  const envRepos = process.env.VALIDATED_REPOS;
  const repoArgs = envRepos
    ? envRepos.split(",").map((r) => r.trim()).filter(Boolean)
    : process.argv.slice(2);

  if (repoArgs.length === 0 || repoArgs.some((a) => !a.includes("/"))) {
    console.error("Usage: tsx src/main.ts owner/repo [owner/repo ...]");
    console.error("Example: tsx src/main.ts opper-ai/opperai-agent-sdk");
    console.error("Example: tsx src/main.ts org/terraform-infra org/app-code");
    console.error("\nRequired env vars: OPPER_API_KEY, GITHUB_TOKEN (for gh CLI)");
    process.exit(1);
  }

  const repos = repoArgs.map((a) => parseRepoArg(a));

  const repoResults = await Promise.all(
    repos.map(([owner, repo]) => runAudit(owner, repo)),
  );
  const allFindings: AgentFindings[] = repoResults.flat();

  const repoNames = repos.map(([o, r]) => `${o}/${r}`);
  const stats = computeStats(repoNames, allFindings);
  const report = generateReport(repoNames, allFindings, stats);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `soc2-report-${timestamp}.md`;
  const outputDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, report);
  console.log(`\nReport saved to ${filepath}`);
  console.log(report);

  const statsSummary = formatStats(stats);
  console.log(statsSummary);

  // Write to GitHub Actions step summary if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n" + statsSummary + "\n");
  }

  // Write stats as GitHub Actions outputs if running in CI
  if (process.env.GITHUB_OUTPUT) {
    const outputLines = [
      `total-findings=${stats.totalFindings}`,
      `critical=${stats.severityCounts.critical}`,
      `high=${stats.severityCounts.high}`,
      `medium=${stats.severityCounts.medium}`,
      `low=${stats.severityCounts.low}`,
      `risk-level=${stats.riskLevel}`,
      `repos-audited=${stats.reposAudited}`,
      `categories-checked=${stats.categoriesChecked}`,
    ];
    appendFileSync(process.env.GITHUB_OUTPUT, outputLines.join("\n") + "\n");
  }
}

main();
