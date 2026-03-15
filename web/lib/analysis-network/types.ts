export type AnalysisEntryRecord = {
  id: string;
  organization_id: string;
  planning_cycle_id: string;
  analysis_type: string;
  sub_type: string | null;
  title: string;
  description: string | null;
  impact_level: number | null;
  uncertainty_level: number | null;
};

export type AnalysisLinkType =
  | "related_to"
  | "contradicts"
  | "causes"
  | "supports"
  | "amplifies"
  | "depends_on"
  | "duplicates";

export type LinkCandidate = {
  sourceEntryId: string;
  targetEntryId: string;
  linkType: AnalysisLinkType;
  strength: number;
  confidence: number;
  comment: string;
  origin: "rule" | "llm" | "hybrid" | "manual";
  provider?: string;
  model?: string;
  promptVersion?: string;
  metadata?: Record<string, unknown>;
};
