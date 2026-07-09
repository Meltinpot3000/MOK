export type SignatureRequestPayload = {
  title: string;
  targetYear: number;
  ownerDisplayName: string;
  directionTitle: string;
  strategicObjectiveTitle: string | null;
  programTitle: string | null;
  description: string;
  measurementLogic: string;
  derivationNote: string | null;
};

export type CreateSignatureRequestResult = {
  providerRequestId: string;
  signatureStatus: "pending" | "sent";
};

export interface AnnualTargetSignatureProvider {
  readonly providerId: string;
  createSignatureRequest(input: {
    organizationId: string;
    annualTargetId: string;
    signerMembershipIds: string[];
    documentPayload: SignatureRequestPayload;
  }): Promise<CreateSignatureRequestResult>;
  getSignatureStatus(providerRequestId: string): Promise<{
    status: string;
    signedAt: string | null;
  }>;
  cancelSignatureRequest(providerRequestId: string): Promise<void>;
  downloadSignedDocument(providerRequestId: string): Promise<string | null>;
}
