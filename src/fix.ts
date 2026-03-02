import { spawnSync } from "node:child_process";
import { HookEvents } from "@opperai/agents";
import type { Finding } from "./schemas.ts";
import { slugify } from "./issues.ts";
import { createFixAgent } from "./fix-agent.ts";

export function branchName(issueNumber: number, findingTitle: string): string {
  const slug = slugify(findingTitle).slice(0, 40).replace(/-+$/, "");
  return `fix/soc2-${issueNumber}-${slug}`;
}

function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { encoding: "utf8", timeout: 60_000, cwd });
  return {
    ok: !result.error && result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function gh(args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync("gh", args, { encoding: "utf8", timeout: 30_000 });
  return { ok: !result.error && result.status === 0, stdout: (result.stdout ?? "").trim() };
}

function changedFiles(localPath: string): string[] {
  const r = git(["diff", "--name-only"], localPath);
  return r.stdout ? r.stdout.split("\n").filter(Boolean) : [];
}

export async function attemptFix(
  owner: string,
  repo: string,
  localPath: string,
  finding: Finding,
  issueNumber: number,
  parentSpanId: string,
): Promise<void> {
  console.log(`  [fix] Attempting fix for #${issueNumber}: ${finding.title}`);
  const agent = createFixAgent(owner, repo, localPath);

  agent.registerHook(HookEvents.BeforeTool, ({ tool, input }: { tool: { name: string }; input?: unknown }) => {
    console.log(`  [fix/${issueNumber}] ${tool.name}`, JSON.stringify(input ?? {}).slice(0, 80));
  });

  const prompt = `Fix this SOC2 finding in the repository ${owner}/${repo}:

Title: ${finding.title}
SOC2 Reference: ${finding.soc2_reference}
Severity: ${finding.severity}
File: ${finding.file_path ?? "unknown"}
Description: ${finding.description}
Recommendation: ${finding.recommendation}`;

  let result: { fixable: boolean; explanation: string };
  try {
    const { result: r } = await agent.run(prompt, parentSpanId);
    result = r;
  } catch (e) {
    console.error(`  [fix] Agent error: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (!result.fixable) {
    console.log(`  [fix] Not fixable: ${result.explanation}`);
    return;
  }

  const changed = changedFiles(localPath);
  if (changed.length === 0) {
    console.log(`  [fix] Agent said fixable but no files were changed`);
    return;
  }

  const branch = branchName(issueNumber, finding.title);
  const baseBranch = git(["rev-parse", "--abbrev-ref", "HEAD"], localPath).stdout || "main";

  if (!git(["checkout", "-b", branch], localPath).ok) {
    console.error(`  [fix] Failed to create branch ${branch}`);
    return;
  }

  git(["add", "-A"], localPath);
  const commitMsg = `fix: SOC2 ${finding.soc2_reference} - ${finding.title}\n\nCloses #${issueNumber}`;
  if (!git(["commit", "-m", commitMsg], localPath).ok) {
    console.error(`  [fix] Failed to commit`);
    git(["checkout", baseBranch], localPath);
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? "";
  const remote = token
    ? `https://x-access-token:${token}@github.com/${owner}/${repo}`
    : `https://github.com/${owner}/${repo}`;

  if (!git(["push", remote, branch], localPath).ok) {
    console.error(`  [fix] Failed to push branch ${branch}`);
    git(["checkout", baseBranch], localPath);
    return;
  }

  const prBody = `## Automated SOC2 fix\n\n**Finding:** ${finding.title}\n**SOC2 Reference:** ${finding.soc2_reference}\n\n${result.explanation}\n\nCloses #${issueNumber}\n\n---\n*Automated fix by [opper-soc2-audit-action](https://github.com/opper-ai/opper-soc2-audit-action)*`;
  const pr = gh([
    "pr", "create",
    "--repo", `${owner}/${repo}`,
    "--base", baseBranch,
    "--head", branch,
    "--title", `Fix SOC2 ${finding.soc2_reference}: ${finding.title}`,
    "--body", prBody,
  ]);

  if (pr.ok) {
    console.log(`  [fix] PR created: ${pr.stdout}`);
  } else {
    console.error(`  [fix] Failed to create PR`);
  }

  git(["checkout", baseBranch], localPath);
}
