import { readFile } from "node:fs/promises";
import path from "node:path";

async function loadSkillMarkdown() {
  const skillPath = path.join(process.cwd(), "content", "SKILL.md");
  return readFile(skillPath, "utf8");
}

export default async function HomePage() {
  const markdown = await loadSkillMarkdown();

  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
      }}
    >
      <pre
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          fontSize: 14
        }}
      >
        {markdown}
      </pre>
    </main>
  );
}
