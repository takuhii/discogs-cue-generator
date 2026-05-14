import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, type } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid release ID" });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return res.status(500).json({ error: "Server misconfigured: missing API credentials" });
  }

  const headers = { "User-Agent": "DiscogsCueGenerator/1.0" };

  try {
    let releaseId = id;

    // If it's a master ID, resolve to the main release first
    if (type === "master") {
      const masterRes = await fetch(
        `https://api.discogs.com/masters/${id}?key=${key}&secret=${secret}`,
        { headers }
      );

      if (!masterRes.ok) {
        return res.status(masterRes.status).json({ error: "Master not found on Discogs" });
      }

      const masterData = await masterRes.json();
      releaseId = String(masterData.main_release);
    }

    const response = await fetch(
      `https://api.discogs.com/releases/${releaseId}?key=${key}&secret=${secret}`,
      { headers }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Release not found on Discogs" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch from Discogs" });
  }
}
