export interface ParsedDoc {
  title: string;
  problem: string;
  plan: string;
  changes: string;
  testing: string;
}

/**
 * Turn a worktree name like "fix-login-redirect" into "Fix Login Redirect".
 */
export function titleFromName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Return the body of a `## <sectionName>` section, without HTML comments.
 * Returns an empty string when the section is missing or only has comments.
 */
export function extractSection(content: string, sectionName: string): string {
  // Match section header and capture until next ## or end of file
  const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);

  if (!match) {
    return "";
  }

  return match[1].replace(/<!--[\s\S]*?-->/g, "").trim();
}

export function parseDocForPr(content: string, name: string): ParsedDoc {
  return {
    title: titleFromName(name),
    problem: extractSection(content, "Problem"),
    plan: extractSection(content, "Plan"),
    changes: extractSection(content, "Changes"),
    testing: extractSection(content, "Testing"),
  };
}

/**
 * Build a PR description from a parsed doc. "Changes" is preferred over
 * "Plan" since it describes what was actually done.
 */
export function buildPrBody(doc: ParsedDoc): string {
  const sections: string[] = [];

  if (doc.problem) {
    sections.push(`## Problem\n\n${doc.problem}`);
  }

  if (doc.changes) {
    sections.push(`## Changes\n\n${doc.changes}`);
  } else if (doc.plan) {
    sections.push(`## Approach\n\n${doc.plan}`);
  }

  if (doc.testing) {
    sections.push(`## Testing\n\n${doc.testing}`);
  }

  return sections.join("\n\n");
}
