import {
  appendMeetingComment,
  parseMeetingNotesThread,
  serializeMeetingNotesThread,
} from "@/lib/strategy-review/meeting-notes-thread";

describe("meeting-notes-thread", () => {
  it("parst leeren String als leeren Thread", () => {
    expect(parseMeetingNotesThread("").comments).toEqual([]);
  });

  it("migriert Legacy-Klartext zu einem Kommentar", () => {
    const t = parseMeetingNotesThread("Alte Notiz");
    expect(t.comments).toHaveLength(1);
    expect(t.comments[0]?.body).toBe("Alte Notiz");
  });

  it("serialisiert und parst Roundtrip", () => {
    const withComment = appendMeetingComment(parseMeetingNotesThread(""), {
      authorMembershipId: "m1",
      authorName: "Alex",
      body: "Hallo",
    });
    const raw = serializeMeetingNotesThread(withComment);
    const again = parseMeetingNotesThread(raw);
    expect(again.comments).toHaveLength(1);
    expect(again.comments[0]?.authorName).toBe("Alex");
    expect(again.comments[0]?.body).toBe("Hallo");
  });
});
