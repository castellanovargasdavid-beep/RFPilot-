/**
 * Pliego ficticio de licitación pública española — "Servicio de
 * mantenimiento de sistemas informáticos". Se usa para:
 *  1) generar el PDF de ejemplo (scripts/generate-mock-tender-pdf.ts),
 *  2) poblar una TenderAnalysis sintética coherente con ese PDF en el seed
 *     (prisma/seed.ts), para poder demostrar el flujo completo (semáforo,
 *     resumen ejecutivo, borrador de propuesta) sin necesitar una
 *     ANTHROPIC_API_KEY real.
 *
 * Cualquier parecido con un ayuntamiento o empresa real es pura
 * coincidencia — nombres y cifras son inventados.
 */

export type ContentBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "pagebreak" };

export const MOCK_TENDER_TITLE =
  "Servicio de mantenimiento de sistemas informáticos del Ayuntamiento de Villaverde de la Sierra";
export const MOCK_CONTRACTING_BODY = "Ayuntamiento de Villaverde de la Sierra";
export const MOCK_MAX_BUDGET = 480_000;
export const MOCK_CURRENCY = "EUR";
export const MOCK_CONTRACT_DURATION_MONTHS = 24;
export const MOCK_SUBMISSION_DEADLINE = "2026-10-20";
export const MOCK_CLARIFICATION_DEADLINE = "2026-10-05";

export const MOCK_TENDER_CONTENT: ContentBlock[] = [
  { type: "title", text: "Pliego de Prescripciones Técnicas y Cláusulas Administrativas Particulares" },
  { type: "subtitle", text: MOCK_TENDER_TITLE },
  {
    type: "paragraph",
    text: "Expediente: SVC-2026-0142. Procedimiento abierto simplificado, tramitación ordinaria. Ayuntamiento de Villaverde de la Sierra, Concejalía de Modernización y Nuevas Tecnologías.",
  },
  { type: "pagebreak" },

  { type: "heading", text: "Cláusula 1. Objeto del contrato" },
  {
    type: "paragraph",
    text: "El presente pliego tiene por objeto la contratación del servicio de mantenimiento preventivo, correctivo y evolutivo de los sistemas informáticos del Ayuntamiento de Villaverde de la Sierra, incluyendo servidores, puestos de trabajo, red de comunicaciones, sistemas de virtualización y aplicaciones corporativas de gestión municipal, con el fin de garantizar la continuidad y disponibilidad de los servicios TIC municipales.",
  },
  {
    type: "paragraph",
    text: "El servicio incluye, entre otras, las siguientes prestaciones: mantenimiento de la infraestructura de servidores (físicos y virtuales), mantenimiento de los más de 180 puestos de trabajo distribuidos en 6 dependencias municipales, gestión y monitorización de la red de comunicaciones, atención de incidencias mediante mesa de ayuda (help desk), gestión de copias de seguridad, y soporte a las aplicaciones de gestión de expedientes, padrón municipal y sede electrónica.",
  },

  { type: "heading", text: "Cláusula 2. Duración del contrato" },
  {
    type: "paragraph",
    text: `La duración del contrato será de ${MOCK_CONTRACT_DURATION_MONTHS} meses (24 meses) a contar desde la fecha de formalización, pudiendo prorrogarse por un periodo adicional de 12 meses previo acuerdo expreso de ambas partes, sin que la duración total del contrato, incluidas las prórrogas, pueda exceder de 36 meses.`,
  },

  { type: "heading", text: "Cláusula 3. Presupuesto base de licitación" },
  {
    type: "paragraph",
    text: `El presupuesto base de licitación asciende a la cantidad de 480.000 € (cuatrocientos ochenta mil euros), IVA excluido, para la totalidad de la duración inicial del contrato (24 meses), lo que supone un importe anual de 240.000 €. El valor estimado del contrato, incluidas eventuales prórrogas, asciende a 720.000 €.`,
  },

  { type: "heading", text: "Cláusula 4. Plazo de presentación de proposiciones" },
  {
    type: "paragraph",
    text: "El plazo de presentación de proposiciones finalizará el día 20 de octubre de 2026, a las 14:00 horas. Las proposiciones se presentarán exclusivamente a través de la plataforma de contratación del sector público.",
  },
  {
    type: "paragraph",
    text: "Los licitadores podrán solicitar aclaraciones o información adicional sobre el presente pliego hasta el día 5 de octubre de 2026, debiendo el órgano de contratación responder con al menos 6 días de antelación a la finalización del plazo de presentación de ofertas.",
  },
  { type: "pagebreak" },

  { type: "heading", text: "Cláusula 5. Capacidad y solvencia de los licitadores" },
  {
    type: "paragraph",
    text: "Podrán presentar proposiciones las personas naturales o jurídicas, españolas o extranjeras, que tengan plena capacidad de obrar, no estén incursas en las prohibiciones de contratar recogidas en la legislación vigente, y acrediten su solvencia económica, financiera y técnica o profesional conforme a lo dispuesto en las siguientes cláusulas.",
  },

  { type: "subheading", text: "5.1 Solvencia económica y financiera" },
  {
    type: "paragraph",
    text: "La solvencia económica y financiera se acreditará mediante el volumen anual de negocios del licitador, que referido al año de mayor volumen de los tres últimos concluidos deberá alcanzar como mínimo el importe de 500.000 € (quinientos mil euros). Este requisito es de carácter excluyente: las proposiciones de licitadores que no acrediten este volumen mínimo de facturación serán excluidas del procedimiento.",
  },

  { type: "subheading", text: "5.2 Solvencia técnica y profesional" },
  {
    type: "paragraph",
    text: "La solvencia técnica se acreditará mediante la relación de los principales servicios o trabajos de igual o similar naturaleza realizados en los últimos cinco años, debiendo el licitador acreditar la ejecución de, al menos, 2 (dos) contratos de mantenimiento de sistemas informáticos de administraciones públicas o entidades de tamaño equivalente, de importe unitario no inferior a 150.000 € cada uno. Este requisito es de carácter excluyente.",
  },

  { type: "subheading", text: "5.3 Certificaciones y normas de garantía de calidad" },
  {
    type: "paragraph",
    text: "Los licitadores deberán estar en posesión de las siguientes certificaciones, en vigor a la fecha de presentación de la oferta:",
  },
  {
    type: "bullet",
    text: "Certificado ISO 9001 de gestión de la calidad, en vigor. Requisito excluyente.",
  },
  {
    type: "bullet",
    text: "Certificado ISO/IEC 27001 de gestión de la seguridad de la información, en vigor. Requisito excluyente, dado que el servicio implica el tratamiento de datos del padrón municipal.",
  },
  {
    type: "bullet",
    text: "Se valorará adicionalmente, sin ser excluyente, la certificación en el Esquema Nacional de Seguridad (ENS), categoría media o superior (ver criterios de adjudicación, cláusula 7).",
  },

  { type: "subheading", text: "5.4 Seguro de responsabilidad civil" },
  {
    type: "paragraph",
    text: "El licitador deberá disponer de un seguro de responsabilidad civil que cubra los daños que pudieran derivarse de la ejecución del contrato, con un límite mínimo de indemnización de 300.000 € por siniestro. Requisito excluyente, a acreditar mediante declaración responsable y copia de la póliza en caso de resultar adjudicatario.",
  },

  { type: "subheading", text: "5.5 Equipo técnico mínimo" },
  {
    type: "paragraph",
    text: "El licitador deberá disponer, dentro de su plantilla o mediante compromiso de adscripción, de al menos un técnico con certificación ITIL v4 Foundation (o superior) y un mínimo de 5 años de experiencia en gestión de servicios TI, que actuará como responsable técnico del contrato. Requisito excluyente.",
  },
  { type: "pagebreak" },

  { type: "heading", text: "Cláusula 6. Documentación administrativa" },
  {
    type: "paragraph",
    text: "Los licitadores deberán presentar declaración responsable conforme al modelo del Anexo II, no estando incursos en prohibición de contratar, y hallándose al corriente en el cumplimiento de sus obligaciones tributarias y con la Seguridad Social. La acreditación fehaciente de estos extremos se exigirá únicamente al licitador que resulte propuesto como adjudicatario, con carácter previo a la adjudicación.",
  },

  { type: "heading", text: "Cláusula 7. Criterios de adjudicación" },
  {
    type: "paragraph",
    text: "La adjudicación del contrato se realizará atendiendo a una pluralidad de criterios, de conformidad con el siguiente baremo, sobre un máximo de 100 puntos:",
  },
  {
    type: "bullet",
    text: "Oferta económica: hasta 40 puntos. Se otorgará la puntuación máxima a la oferta más económica, puntuando el resto de forma proporcional.",
  },
  {
    type: "bullet",
    text: "Plan de mantenimiento preventivo y correctivo: hasta 25 puntos. Se valorará la calidad, exhaustividad y adecuación del plan de mantenimiento propuesto, incluyendo la periodicidad de las revisiones preventivas y los procedimientos de resolución de incidencias.",
  },
  {
    type: "bullet",
    text: "Metodología de gestión de incidencias y niveles de servicio (SLA): hasta 20 puntos. Se valorarán los tiempos de respuesta y resolución comprometidos para incidencias críticas, altas, medias y bajas, así como la herramienta de gestión de incidencias propuesta.",
  },
  {
    type: "bullet",
    text: "Mejoras adicionales sin coste para el Ayuntamiento: hasta 15 puntos, entre las que se valorará específicamente disponer de la certificación ENS categoría media o superior (hasta 5 de los 15 puntos de este apartado).",
  },

  { type: "heading", text: "Anexo I. Contenido de la memoria técnica" },
  {
    type: "paragraph",
    text: "Los licitadores deberán presentar, dentro del sobre correspondiente a la documentación técnica, una memoria que desarrolle, como mínimo, los siguientes apartados, en el orden indicado, sin incluir en ella información relativa al precio ofertado:",
  },
  { type: "bullet", text: "1. Resumen ejecutivo de la propuesta." },
  { type: "bullet", text: "2. Plan de mantenimiento preventivo y correctivo, incluyendo calendario de revisiones preventivas y procedimiento detallado de mantenimiento correctivo." },
  { type: "bullet", text: "3. Metodología de gestión de incidencias y niveles de servicio (SLA) comprometidos por tipo de incidencia." },
  { type: "bullet", text: "4. Equipo técnico asignado al contrato, con indicación de perfiles, titulaciones y experiencia." },
  { type: "bullet", text: "5. Mejoras adicionales propuestas sin coste para el Ayuntamiento." },
  {
    type: "paragraph",
    text: "La memoria técnica no podrá exceder de 40 páginas, a una cara, letra Arial 11 o equivalente, y deberá presentarse en formato PDF.",
  },
];
