export function srDebug(tag: string, message: string, data?: unknown) {
  const line = `[SR-DEBUG][${tag}] ${message}`;
  // Browser-Konsole
  console.log(line, data ?? "");
  // Dev-Server-Terminal (eine Zeile zuerst, damit nichts abgeschnitten wird)
  try {
    void fetch("/api/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag,
        message,
        data:
          data === undefined
            ? undefined
            : typeof data === "string"
              ? data
              : JSON.parse(
                  JSON.stringify(data, (_k, v) =>
                    typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}…` : v
                  )
                ),
      }),
      keepalive: true,
    }).catch((err) => {
      console.warn("[SR-DEBUG] fetch failed", err);
    });
  } catch (err) {
    console.warn("[SR-DEBUG] sync fail", err);
  }
}
