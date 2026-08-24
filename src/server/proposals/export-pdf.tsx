import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { ProposalDraftDetail } from "./detail-select";
import { flattenSectionTree, type FlatSectionNode } from "./section-tree";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 24 },
  heading1: { fontSize: 16, fontWeight: "bold", marginTop: 20, marginBottom: 8 },
  heading2: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  heading3: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  paragraph: { marginBottom: 8 },
  bullet: { marginBottom: 4, marginLeft: 12 },
  placeholder: { marginBottom: 8, fontStyle: "italic", color: "#666666" },
  bold: { fontWeight: "bold" },
});

const HEADING_STYLES = [styles.heading1, styles.heading2, styles.heading3];

function renderInlineBold(line: string, keyPrefix: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={`${keyPrefix}-${i}`} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-${i}`}>{part}</Text>
    )
  );
}

function ContentBlock({ content, sectionId }: { content: string | null; sectionId: string }) {
  if (!content) {
    return <Text style={styles.placeholder}>(sección pendiente de generar)</Text>;
  }
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <>
      {lines.map((line, i) => {
        const key = `${sectionId}-line-${i}`;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <Text key={key} style={styles.bullet}>
              • {renderInlineBold(line.slice(2), key)}
            </Text>
          );
        }
        return (
          <Text key={key} style={styles.paragraph}>
            {renderInlineBold(line, key)}
          </Text>
        );
      })}
    </>
  );
}

function SectionBlock({ node, depth }: { node: FlatSectionNode; depth: number }) {
  return (
    <View>
      <Text style={HEADING_STYLES[Math.min(depth, HEADING_STYLES.length - 1)]}>{node.title}</Text>
      <ContentBlock content={node.content} sectionId={node.id} />
      {node.children.map((child) => (
        <SectionBlock key={child.id} node={child} depth={depth + 1} />
      ))}
    </View>
  );
}

export async function buildProposalPdf(draft: ProposalDraftDetail): Promise<Buffer> {
  const tree = flattenSectionTree(draft);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{draft.title}</Text>
        {tree.map((section) => (
          <SectionBlock key={section.id} node={section} depth={0} />
        ))}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
