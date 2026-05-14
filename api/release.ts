import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid release ID" });
  }

  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;

  if (!key || !secret) {
    return res.status(500).json({ error: "Server misconfigured: missing API credentials" });
  }

  try {
    const response = await fetch(
      `https://api.discogs.com/releases/${id}?key=${key}&secret=${secret}`,
      {
        headers: {
          "User-Agent": "DiscogsCueGenerator/1.0",
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Discogs API error" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch from Discogs" });
  }
}
