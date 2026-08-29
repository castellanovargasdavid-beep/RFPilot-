import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso legal — RFPilot",
  description: "Naturaleza del servicio, limitación de responsabilidad y condiciones de uso de RFPilot.",
};

export default function AvisoLegalPage() {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Aviso legal</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {new Date().toLocaleDateString("es-ES")}</p>

      <div className="prose prose-sm mt-10 max-w-none space-y-8 text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        <section>
          <h2>1. Naturaleza del servicio</h2>
          <p>
            RFPilot es una herramienta de apoyo basada en inteligencia artificial para el análisis de pliegos de
            licitaciones públicas (PCAP y PPT) y RFPs corporativos. RFPilot <strong>no presta asesoramiento jurídico,
            fiscal ni de ningún otro tipo</strong>, y no sustituye el criterio profesional de un abogado, asesor de
            contratación pública o cualquier otro profesional cualificado. El servicio está diseñado como un
            &ldquo;copiloto auditable&rdquo;: cada resultado se acompaña de la cita textual, la página y la cláusula
            del documento original de la que procede, para que puedas verificarlo tú mismo antes de actuar.
          </p>
        </section>

        <section>
          <h2>2. Exactitud de los resultados y responsabilidad del usuario</h2>
          <p>
            Los análisis se generan mediante modelos de inteligencia artificial combinados con procesos deterministas
            de verificación de citas (ver la funcionalidad de guardrail descrita en la propia aplicación). A pesar de
            estos controles, los resultados <strong>pueden contener errores, omisiones o interpretaciones
            incorrectas</strong> del contenido del pliego — especialmente en documentos escaneados de baja calidad,
            con tablas complejas o formatos no estándar.
          </p>
          <p>
            Es responsabilidad exclusiva del usuario revisar y confirmar cada requisito, cita y resultado antes de
            tomar cualquier decisión con consecuencias reales — incluyendo, entre otras, presentarse o no a una
            licitación, elaborar una oferta, o descartar una licitación por supuesto incumplimiento de un requisito
            excluyente. RFPilot proporciona los medios para esa verificación (citas literales, ubicación exacta en el
            documento, y un mecanismo de confirmación explícita por requisito); no verificar antes de actuar es una
            decisión del usuario, no una garantía del servicio.
          </p>
        </section>

        <section>
          <h2>3. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la legislación aplicable, RFPilot y sus responsables no serán
            responsables de pérdidas, daños, costes o perjuicios de cualquier naturaleza derivados de decisiones
            adoptadas en base a los resultados del servicio, incluida la exclusión de un procedimiento de
            contratación, la pérdida de una licitación, o costes incurridos en la preparación de una oferta.
          </p>
        </section>

        <section>
          <h2>4. Datos y confidencialidad</h2>
          <p>
            Los documentos que subes se procesan para generar tu análisis y no se utilizan para entrenar modelos de
            inteligencia artificial de terceros. El tratamiento de datos personales se realiza conforme al Reglamento
            General de Protección de Datos (RGPD). Los datos sensibles del perfil de empresa (CIF/NIF, importes de
            facturación) se almacenan cifrados en reposo.
          </p>
        </section>

        <section>
          <h2>5. Propiedad intelectual de los documentos analizados</h2>
          <p>
            El contenido de los pliegos y RFPs que subes pertenece a sus respectivos titulares (órganos de
            contratación o empresas convocantes). RFPilot los procesa exclusivamente por cuenta del usuario y para la
            finalidad de generar el análisis solicitado.
          </p>
        </section>

        <section>
          <h2>6. Contacto</h2>
          <p>Para cualquier consulta sobre este aviso legal o sobre el servicio, contacta a través de los canales indicados en tu cuenta.</p>
        </section>
      </div>
    </div>
  );
}
