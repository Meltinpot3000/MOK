/** Anzeige unter /invitations (Admin). */
export function memberInvitationStatusLabelDe(status: string): string {
  switch (status) {
    case "pending":
      return "Offen";
    case "accepted":
      return "Abgeschlossen";
    case "revoked":
      return "Widerrufen";
    case "expired":
      return "Abgelaufen";
    default:
      return status;
  }
}
