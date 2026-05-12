import type { ExecutableSemanticMap, SemanticMapValidationSummary } from "../types";

export type SemanticMapRuntimeDiagnostics = {
  hasActiveSnapshot: boolean;
  /** Mind. ein verified Place (inhaltliche Bezugspunkte). */
  executableForPlacesOnly: boolean;
  /** Mind. eine verified Road (Cross-Place-Navigation ohne inferred). */
  executableForCrossPlaceRoutes: boolean;
  /** Kurz: sinnvolle Sentinel-Runtime-Nutzung mit Standard-Policy (nur verified Roads). */
  runtimeExecutableStrict: boolean;
  validationSummary: SemanticMapValidationSummary | null;
  verifiedRoadsCount: number;
  inferredRoadsCount: number;
};

export function buildSemanticMapRuntimeDiagnostics(
  map: ExecutableSemanticMap | null
): SemanticMapRuntimeDiagnostics {
  if (!map) {
    return {
      hasActiveSnapshot: false,
      executableForPlacesOnly: false,
      executableForCrossPlaceRoutes: false,
      runtimeExecutableStrict: false,
      validationSummary: null,
      verifiedRoadsCount: 0,
      inferredRoadsCount: 0,
    };
  }
  const vs = map.validationSummary;
  const verifiedRoadsCount = map.roadsExecutableVerified.length;
  const inferredRoadsCount = map.roadsAll.filter((r) => r.validationStatus === "inferred").length;
  const placesOk = vs.places.verified >= 1;
  const roadsOk = verifiedRoadsCount >= 1;
  return {
    hasActiveSnapshot: true,
    executableForPlacesOnly: placesOk,
    executableForCrossPlaceRoutes: placesOk && roadsOk,
    runtimeExecutableStrict: placesOk && roadsOk,
    validationSummary: vs,
    verifiedRoadsCount,
    inferredRoadsCount,
  };
}
