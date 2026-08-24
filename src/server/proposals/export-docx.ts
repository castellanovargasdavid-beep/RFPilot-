import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

import type { ProposalDraftDetail } from "./detail-select";
import { flattenSectionTree, type FlatSectionNode } from "./section-tree";

const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

/** "**negrita**" -> TextRuns con bold, resto como texto plano. Markdown mínimo, no un parser completo. */
function markdownLineToRuns(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  if (parts.length === 0) return [new TextRun("")];
  return parts.map((part) =>
    part.startsWith("**") && part.endsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true })
      : new TextRun(part)
  );
}

function contentToParagraphs(content: string | null): Paragraph[] {
  if (!content) {
    return [new Paragraph({ children: [new TextRun({ text: "(sección pendiente de generar)", italics: true })] })];
  }
  const paragraphs: Paragraph[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(new Paragraph({ children: markdownLineToRuns(line.slice(2)), bullet: { level: 0 } }));
    } else {
      paragraphs.push(new Paragraph({ children: markdownLineToRuns(line), spacing: { after: 120 } }));
    }
  }
  return paragraphs;
}

function sectionToParagraphs(node: FlatSectionNode, depth: number): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({ text: node.title, heading: HEADING_LEVELS[Math.min(depth, HEADING_LEVELS.length - 1)] }),
    ...contentToParagraphs(node.content),
  ];
  for (const child of node.children) {
    paragraphs.push(...sectionToParagraphs(child, depth + 1));
  }
  return paragraphs;
}

export async function buildProposalDocx(draft: ProposalDraftDetail): Promise<Buffer> {
  const tree = flattenSectionTree(draft);

  const children: Paragraph[] = [new Paragraph({ text: draft.title, heading: HeadingLevel.TITLE })];
  for (const section of tree) {
    children.push(...sectionToParagraphs(section, 0));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
