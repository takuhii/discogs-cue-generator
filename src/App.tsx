import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Analytics } from "@vercel/analytics/react"

type CueMode = "merged" | "perdisc";

export default function App() {
  const [releaseId, setReleaseId] = useState("");
  const [cueMode, setCueMode] = useState<CueMode>("merged");
  const [status, setStatus] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = async (previewOnly = false) => {
    if (!releaseId) return;
    setStatus("Fetching release data…");

    try {
      const res = await fetch(`/api/release?id=${releaseId}`);
      if (!res.ok) throw new Error("Release not found");
      const data = await res.json();

      if (cueMode === "merged") {
        previewOnly ? previewMergedCue(data) : generateMergedCue(data);
      } else {
        previewOnly ? previewPerDiscCues(data) : generatePerDiscZip(data);
      }

      if (!previewOnly) setStatus("✅ CUE file(s) generated successfully!");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to generate CUE file.");
    }
  };

  const sanitize = (str: string) =>
    str.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").trim();

  const saveFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 🔹 Build merged CUE text
  const buildMergedCue = (data: any) => {
    const albumTitle = data.title || "Unknown Album";
    const artist = data.artists_sort || "Various Artists";
    const safeName = sanitize(albumTitle);

    let cue = `TITLE "${albumTitle}"\nPERFORMER "${artist}"\nFILE "${safeName}.mp3" MP3\n`;

    let trackNum = 1;
    let totalSeconds = 0;

    for (const track of data.tracklist) {
      if (track.type_ === "track" && track.duration) {
        const durParts = track.duration.split(":").map(Number);
        const trackSeconds = durParts[0] * 60 + (durParts[1] || 0);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        cue += `  TRACK ${trackNum.toString().padStart(2, "0")} AUDIO\n`;
        cue += `    TITLE "${track.title}"\n`;
        cue += `    PERFORMER "${track.artists?.[0]?.name || artist}"\n`;
        cue += `    INDEX 01 ${String(mins).padStart(2, "0")}:${String(
          secs
        ).padStart(2, "0")}:00\n`;

        totalSeconds += trackSeconds;
        trackNum++;
      }
    }

    return cue;
  };

  const previewMergedCue = (data: any) => {
    setPreviewContent(buildMergedCue(data));
    setShowPreview(true);
  };

  const generateMergedCue = (data: any) => {
    const safeName = sanitize(data.title || "Unknown Album");
    const cue = buildMergedCue(data);
    saveFile(`${safeName}.cue`, cue);
  };

  // 🔹 Build per-disc CUEs
  const buildPerDiscCues = (data: any) => {
    const albumTitle = data.title || "Unknown Album";
    const artist = data.artists_sort || "Various Artists";
    const safeAlbumName = sanitize(albumTitle);

    let currentDisc = "";
    let trackNum = 1;
    let totalSeconds = 0;
    let cue = "";
    const cueFiles: { name: string; text: string }[] = [];

    const flushCue = () => {
      if (currentDisc && cue) {
        const discSafe = sanitize(currentDisc);
        cueFiles.push({
          name: `${safeAlbumName}_${discSafe}.cue`,
          text: cue,
        });
      }
      cue = "";
      totalSeconds = 0;
      trackNum = 1;
    };

    for (const track of data.tracklist) {
      if (track.type_ === "heading") {
        if (cue) flushCue();
        currentDisc = track.title;
        const discSafe = sanitize(currentDisc);
        cue = `TITLE "${track.title}"\nPERFORMER "${artist}"\nFILE "${safeAlbumName}_${discSafe}.mp3" MP3\n`;
      } else if (track.type_ === "track" && track.duration) {
        const durParts = track.duration.split(":").map(Number);
        const trackSeconds = durParts[0] * 60 + (durParts[1] || 0);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        cue += `  TRACK ${trackNum.toString().padStart(2, "0")} AUDIO\n`;
        cue += `    TITLE "${track.title}"\n`;
        cue += `    PERFORMER "${track.artists?.[0]?.name || artist}"\n`;
        cue += `    INDEX 01 ${String(mins).padStart(2, "0")}:${String(
          secs
        ).padStart(2, "0")}:00\n`;

        totalSeconds += trackSeconds;
        trackNum++;
      }
    }

    if (cue) flushCue();
    return cueFiles;
  };

  const previewPerDiscCues = (data: any) => {
    const cues = buildPerDiscCues(data);
    const combined = cues.map(c => `# ${c.name}\n\n${c.text}`).join("\n\n-----\n\n");
    setPreviewContent(combined);
    setShowPreview(true);
  };

  // 🔹 NEW: Generate ZIP file for per-disc mode
  const generatePerDiscZip = async (data: any) => {
    const cues = buildPerDiscCues(data);
    const albumTitle = sanitize(data.title || "Unknown_Album");
    const zip = new JSZip();

    cues.forEach(({ name, text }) => zip.file(name, text));

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${albumTitle}_CUEs.zip`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🎵 Discogs → CUE Generator
      </h1>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <input
          type="text"
          placeholder="Enter Discogs Release ID (e.g. 263908)"
          className="p-3 rounded text-black"
          value={releaseId}
          onChange={(e) => setReleaseId(e.target.value)}
        />

        <select
          value={cueMode}
          onChange={(e) => setCueMode(e.target.value as CueMode)}
          className="p-3 rounded text-black"
        >
          <option value="merged">Single merged .cue (1 MP3)</option>
          <option value="perdisc">Per-disc .cue (ZIP)</option>
        </select>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => handleGenerate(false)}
            className="bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold w-1/2"
          >
            Generate CUE
          </button>
          <button
            onClick={() => handleGenerate(true)}
            className="bg-gray-700 hover:bg-gray-800 p-3 rounded font-semibold w-1/2"
          >
            Preview CUE
          </button>
        </div>

        {status && <p className="text-center mt-4">{status}</p>}
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold mb-4">CUE Preview</h2>
            <pre className="bg-gray-900 p-4 rounded max-h-[60vh] overflow-y-auto text-sm whitespace-pre-wrap">
              {previewContent}
            </pre>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowPreview(false)}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
}
