export type VisualizationViewMode = "constellation" | "influence" | "cluster" | "terrain" | "table";

export type VisualizationNode = {
  id: string;
  label: string;
  analysisType: string;
  subType: string | null;
  impact: number;
  uncertainty: number;
  qualityScore: number;
  description: string | null;
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  operatingModels: Array<{ id: string; name: string }>;
  clusterId: string | null;
  clusterLabel: string | null;
  directionCount?: number;
  challengeMapped?: boolean;
};

export type VisualizationEdge = {
  id: string;
  source: string;
  target: string;
  linkType: string;
  strength: number;
  confidence: number;
  comment: string | null;
  triScores?: {
    proximityScore: number;
    supportScore: number;
    repulsionScore: number;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
  history?: Array<{
    at: string;
    byMembershipId: string | null;
    previous: { linkType: string; strength: number; comment: string | null };
    next: { linkType: string; strength: number; comment: string | null };
  }>;
  isDraft?: boolean;
};

export type PositionedNode = VisualizationNode & {
  x: number;
  y: number;
  z: number;
};
