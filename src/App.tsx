import React, { useState } from "react";

export default function App() {
  const [releaseId, setReleaseId] = useState("");
  const [status, setStatus] = useState("");
  const [cueContent, setCueContent] = useState("");

  async function generateCue() {
    if (!releaseId) {
      alert("Please enter a Discogs release number");
      return;
    }

    setStatus("Fetching release data...");
    setCueContent("");

    try {
      const res = await fetch(`https://api.discogs.com/releases/${releaseId}`);
      if (!res.ok) throw new Error("Release not found");
      const data = await res.json();

      const tracks = data.tracklist.filter((t: any) => t.type_ === "track");

      const toSeconds = (dur: string) => {
        const [m, s] = dur.split(":").map(Number);
        return m * 60 + s;
      };

      const toMMSS = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, "0")}:${s
          .toString()
          .padStart(2, "0")}:00`;
      };

      let cue = [];
      cue.push(`REM GENRE ${data.genres?.[0] || "Unknown"}`);
      cue.push(`REM DATE ${data.year || ""}`);
      cue.push(`PERFORMER "${data.artists_sort || "Various"}"`);
      cue.push(`TITLE "${data.title || ""}"`);
      cue.push(`FILE "Gallery.mp3" MP3`);

      let time = 0;
      tracks.forEach((t: any, i: number) => {
        const artist = t.artists?.[0]?.name || "Unknown";
        const title = t.title || "Untitled";
        const dur = t.duration || "0:00";

        cue.push(`  TRACK ${(i + 1).toString().padStart(2, "0")} AUDIO`);
        cue.push(`    TITLE "${title}"`);
        cue.push(`    PERFORMER "${artist}"`);
        cue.push(`    INDEX 01 ${toMMSS(time)}`);

        if (dur.includes(":")) time += toSeconds(dur);
      });

      const cueText = cue.join("\n");
      setCueContent(cueText);
      setStatus("✅ CUE generated!");

      // Download automatically
      const blob = new Blob([cueText], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${data.title || "release"}.cue`;
      link.click();
    } catch (e: any) {
      setStatus(`❌ Error: ${e.message}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">
        🎵 Discogs → MP3 .CUE Generator
      </h1>
      <p className="text-gray-300 mb-4">
        Enter a Discogs <b>Release ID</b> (e.g. <code>263908</code>)
      </p>
      <div className="flex space-x-2">
        <input
          value={releaseId}
          onChange={(e) => setReleaseId(e.target.value)}
          className="px-4 py-2 rounded-lg text-black"
          placeholder="Discogs release number"
        />
        <button
          onClick={generateCue}
          className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold"
        >
          Generate
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-400">{status}</p>

      {cueContent && (
        <textarea
          readOnly
          className="w-full mt-6 p-4 bg-gray-800 text-green-300 font-mono text-xs rounded-lg"
          rows={20}
          value={cueContent}
        />
      )}
    </div>
  );
}
