// api/sheets.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const scriptUrl = process.env.APPS_SCRIPT_URL || body.scriptUrl;
    if (!scriptUrl || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(scriptUrl)) {
      return res.status(400).json({ ok: false, error: "Missing or invalid APPS_SCRIPT_URL (/exec)" });
    }

    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    // Try to return JSON; fall back to text for debugging
    if (upstream.headers.get("content-type")?.includes("application/json")) {
      return res.status(upstream.status).send(text);
    }
    try {
      const json = JSON.parse(text);
      return res.status(upstream.status).json(json);
    } catch {
      return res.status(upstream.status).json({ ok: upstream.ok, status: upstream.status, body: text.slice(0, 500) });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
