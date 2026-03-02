import { test } from "node:test";
import assert from "node:assert/strict";
import { branchName } from "./fix.ts";

test("branchName produces valid git branch name", () => {
  assert.equal(branchName(42, "Hardcoded API key in config!"), "fix/soc2-42-hardcoded-api-key-in-config");
});

test("branchName truncates long titles", () => {
  const long = "a".repeat(100);
  assert.ok(branchName(1, long).length < 60);
});
