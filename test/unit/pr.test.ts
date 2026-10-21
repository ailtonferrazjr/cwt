import { describe, expect, it } from "vitest";
import { buildPrBody, extractSection, parseDocForPr, titleFromName } from "../../src/lib/pr.js";
import { DEFAULT_TEMPLATE } from "../../src/lib/docs.js";

const doc = `---
tags: [backend]
---

# fix-login-redirect

## Problem

<!-- What problem does this solve? -->
Users land on a 404 after logging in from a deep link.

## Plan

Store the original URL before redirecting to the login page.

## Changes

- Persist \`returnTo\` in the session
- Redirect to it after login

## Testing

<!--
How was this verified
-->

## Learnings

The auth middleware runs before the session is loaded.
`;

describe("extractSection", () => {
  it("returns the section body up to the next heading", () => {
    expect(extractSection(doc, "Plan")).toBe(
      "Store the original URL before redirecting to the login page."
    );
  });

  it("strips HTML comments", () => {
    expect(extractSection(doc, "Problem")).toBe(
      "Users land on a 404 after logging in from a deep link."
    );
  });

  it("returns an empty string for a section that only has comments", () => {
    expect(extractSection(doc, "Testing")).toBe("");
  });

  it("returns an empty string for a missing section", () => {
    expect(extractSection(doc, "Rollout")).toBe("");
  });

  it("matches the heading case-insensitively", () => {
    expect(extractSection(doc, "changes")).toContain("Persist `returnTo`");
  });

  it("captures the last section through the end of the file", () => {
    expect(extractSection(doc, "Learnings")).toBe(
      "The auth middleware runs before the session is loaded."
    );
  });

  it("finds nothing in an unfilled default template", () => {
    for (const section of ["Problem", "Plan", "Changes", "Testing"]) {
      expect(extractSection(DEFAULT_TEMPLATE, section)).toBe("");
    }
  });
});

describe("titleFromName", () => {
  it("converts kebab-case to title case", () => {
    expect(titleFromName("fix-login-redirect")).toBe("Fix Login Redirect");
  });
});

describe("buildPrBody", () => {
  it("prefers Changes over Plan and skips empty sections", () => {
    const body = buildPrBody(parseDocForPr(doc, "fix-login-redirect"));
    expect(body).toBe(
      [
        "## Problem\n\nUsers land on a 404 after logging in from a deep link.",
        "## Changes\n\n- Persist `returnTo` in the session\n- Redirect to it after login",
      ].join("\n\n")
    );
  });

  it("falls back to the Plan as an Approach section", () => {
    const body = buildPrBody({
      title: "x",
      problem: "",
      plan: "Do the thing",
      changes: "",
      testing: "Ran it",
    });
    expect(body).toBe("## Approach\n\nDo the thing\n\n## Testing\n\nRan it");
  });

  it("returns an empty body when the doc has no content", () => {
    expect(buildPrBody(parseDocForPr(DEFAULT_TEMPLATE, "x"))).toBe("");
  });
});
