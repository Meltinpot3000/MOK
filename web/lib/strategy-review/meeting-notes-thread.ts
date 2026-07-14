/** Meeting-Notiz-Thread (JSON in okr_reviews.meeting_notes). */

export type StrategyReviewMeetingComment = {
  id: string;
  authorMembershipId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type StrategyReviewMeetingNotesThread = {
  version: 1;
  comments: StrategyReviewMeetingComment[];
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Liest Legacy-Plaintext oder JSON-Thread. */
export function parseMeetingNotesThread(raw: string | null | undefined): StrategyReviewMeetingNotesThread {
  const text = (raw ?? "").trim();
  if (!text) return { version: 1, comments: [] };

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Partial<StrategyReviewMeetingNotesThread>;
      if (parsed && Array.isArray(parsed.comments)) {
        return {
          version: 1,
          comments: parsed.comments
            .filter(
              (c): c is StrategyReviewMeetingComment =>
                Boolean(c) &&
                typeof c === "object" &&
                typeof (c as StrategyReviewMeetingComment).body === "string" &&
                typeof (c as StrategyReviewMeetingComment).createdAt === "string"
            )
            .map((c) => ({
              id: typeof c.id === "string" && c.id ? c.id : newId(),
              authorMembershipId:
                typeof c.authorMembershipId === "string" ? c.authorMembershipId : "",
              authorName:
                typeof c.authorName === "string" && c.authorName.trim()
                  ? c.authorName.trim()
                  : "Unbekannt",
              body: c.body,
              createdAt: c.createdAt,
            })),
        };
      }
    } catch {
      /* Legacy plain text */
    }
  }

  return {
    version: 1,
    comments: [
      {
        id: newId(),
        authorMembershipId: "",
        authorName: "Notiz",
        body: text,
        createdAt: new Date(0).toISOString(),
      },
    ],
  };
}

export function serializeMeetingNotesThread(thread: StrategyReviewMeetingNotesThread): string {
  return JSON.stringify({
    version: 1,
    comments: thread.comments,
  } satisfies StrategyReviewMeetingNotesThread);
}

export function appendMeetingComment(
  thread: StrategyReviewMeetingNotesThread,
  input: {
    authorMembershipId: string;
    authorName: string;
    body: string;
  }
): StrategyReviewMeetingNotesThread {
  const body = input.body.trim();
  if (!body) return thread;
  return {
    version: 1,
    comments: [
      ...thread.comments,
      {
        id: newId(),
        authorMembershipId: input.authorMembershipId,
        authorName: input.authorName.trim() || "Unbekannt",
        body,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function formatMeetingCommentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function meetingCommentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}
