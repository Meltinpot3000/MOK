import type {
  AnnualTargetSignatureProvider,
  CreateSignatureRequestResult,
} from "@/lib/annual-targets/signature/types";

/** MVP: interner Bestätigungsflow ohne externen Anbieter. */
export const internalAcknowledgementProvider: AnnualTargetSignatureProvider = {
  providerId: "internal_acknowledgement",

  async createSignatureRequest(): Promise<CreateSignatureRequestResult> {
    return {
      providerRequestId: `internal-${crypto.randomUUID()}`,
      signatureStatus: "sent",
    };
  },

  async getSignatureStatus(providerRequestId: string) {
    return { status: "pending", signedAt: null };
  },

  async cancelSignatureRequest() {
    return;
  },

  async downloadSignedDocument() {
    return null;
  },
};
