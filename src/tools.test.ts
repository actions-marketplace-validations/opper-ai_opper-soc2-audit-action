import { describe, it } from "node:test";
import assert from "node:assert";
import { parseRepoArg } from "./tools.ts";

describe("parseRepoArg", () => {
  it("parses valid owner/repo", () => {
    const [owner, repo] = parseRepoArg("opper-ai/sdk");
    assert.strictEqual(owner, "opper-ai");
    assert.strictEqual(repo, "sdk");
  });

  it("throws on invalid format", () => {
    assert.throws(() => parseRepoArg("invalid"), /Invalid repo/);
  });
});
