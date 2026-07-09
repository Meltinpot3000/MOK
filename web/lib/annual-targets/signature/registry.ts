import type { AnnualTargetSignatureProvider } from "@/lib/annual-targets/signature/types";
import { internalAcknowledgementProvider } from "@/lib/annual-targets/signature/internal-acknowledgement-provider";

const externalStub: AnnualTargetSignatureProvider = {
  providerId: "external_signature",
  async createSignatureRequest() {
    throw new Error("Externer Signaturanbieter ist noch nicht konfiguriert.");
  },
  async getSignatureStatus() {
    return { status: "failed", signedAt: null };
  },
  async cancelSignatureRequest() {
    throw new Error("Externer Signaturanbieter ist noch nicht konfiguriert.");
  },
  async downloadSignedDocument() {
    return null;
  },
};

export function resolveAnnualTargetSignatureProvider(
  mode: string
): AnnualTargetSignatureProvider {
  if (mode === "external_signature") return externalStub;
  if (mode === "internal_acknowledgement") return internalAcknowledgementProvider;
  return internalAcknowledgementProvider;
}
