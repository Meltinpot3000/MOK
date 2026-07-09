export type ReferenceNetworkZone = "strategy" | "execution" | "okr" | "review";

export type ReferenceNodeKind =
  | "analysis_entry"
  | "analysis_cluster"
  | "challenge"
  | "direction"
  | "strategy_objective"
  | "program"
  | "annual_target"
  | "initiative"
  | "okr_objective"
  | "key_result"
  | "review_session"
  | "unternehmensinfo";

export type ReferenceNetworkNode = {
  id: string;
  kind: ReferenceNodeKind;
  zone: ReferenceNetworkZone;
  label: string;
  description: string;
  examples: string[];
  moduleHref: string | null;
  manualAnchor?: string;
  dbTables: string[];
};

export type ReferenceNetworkEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  cardinality: string;
  optional: boolean;
  ruleKey: string | null;
  dbTables: string[];
  uiSurfaces: string[];
  description: string;
};

export type ReferenceNetworkGraph = {
  nodes: ReferenceNetworkNode[];
  edges: ReferenceNetworkEdge[];
};

export type PositionedReferenceNetworkNode = ReferenceNetworkNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReferenceFaqItem = {
  id: string;
  question: string;
  answer: string;
};
