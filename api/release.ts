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

  const fetchJson = async (url: string) => {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    return r.json();
  };

  try {
    let releaseId = id;

    if (type === "master") {
      // First try the main release
      const masterData = await fetchJson(
        `https://api.discogs.com/masters/${id}?key=${key}&secret=${secret}`
      );

      if (!masterData) {
        return res.status(404).json({ error: "Master not found on Discogs" });
      }

      // Try main release first
      const mainRelease = await fetchJson(
        `https://api.discogs.com/releases/${masterData.main_release}?key=${key}&secret=${secret}`
      );

      const hasTimings = (data: any) =>
        data?.tracklist?.some((t: any) => t.type_ === "track" && t.duration);

      if (mainRelease && hasTimings(mainRelease)) {
        return res.status(200).json(mainRelease);
      }

      // Main release has no timings — search versions for one that does
      let page = 1;
      const maxPages = 5; // Don't search forever

      while (page <= maxPages) {
        const versionsData = await fetchJson(
          `https://api.discogs.com/masters/${id}/versions?key=${key}&secret=${secret}&page=${page}&per_page=50`
        );

        if (!versionsData?.versions?.length) break;

        for (const version of versionsData.versions) {
          if (version.id === masterData.main_release) continue; // Already tried

          const release = await fetchJson(
            `https://api.discogs.com/releases/${version.id}?key=${key}&secret=${secret}`
          );

          if (release && hasTimings(release)) {
            return res.status(200).json(release);
          }
        }

        if (page >= versionsData.pagination?.pages) break;
        page++;
      }

      // Fallback: return main release even without timings
      if (mainRelease) {
        return res.status(200).json(mainRelease);
      }

      return res.status(404).json({ error: "No release with track timings found" });
    }

    // Regular release ID
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
