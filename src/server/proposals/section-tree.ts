import type { ProposalDraftDetail } from "./detail-select";

/**
 * El resultado de Prisma tiene una profundidad de anidación fija en su
 * tipo (children -> children -> children, sin más), lo que no encaja con
 * una función recursiva genérica. Aplanamos a un tipo autorreferencial
 * limpio una sola vez, aquí, y todo lo que consume el árbol (export a
 * Word/PDF, UI) trabaja con esa forma simple.
 */
export interface FlatSectionNode {
  id: string;
  title: string;
  content: string | null;
  status: string;
  children: FlatSectionNode[];
}

interface RawSectionNode {
  id: string;
  title: string;
  content: string | null;
  status: string;
  children?: RawSectionNode[];
}

function toFlatNode(section: RawSectionNode): FlatSectionNode {
  return {
    id: section.id,
    title: section.title,
    content: section.content,
    status: section.status,
    children: (section.children ?? []).map(toFlatNode),
  };
}

export function flattenSectionTree(draft: ProposalDraftDetail): FlatSectionNode[] {
  return draft.sections.map(toFlatNode);
}
