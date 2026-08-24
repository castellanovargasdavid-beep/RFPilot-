import { EventSchemas, Inngest } from "inngest";

type Events = {
  "tender/uploaded": {
    data: {
      tenderId: string;
    };
  };
  "tender/extraction.completed": {
    data: {
      tenderId: string;
    };
  };
  "tender/analysis.requested": {
    data: {
      tenderId: string;
      companyProfileId?: string;
    };
  };
  "proposal/outline.requested": {
    data: {
      draftId: string;
    };
  };
  "proposal/section.generation.requested": {
    data: {
      sectionId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "rfpilot",
  schemas: new EventSchemas().fromRecord<Events>(),
});
