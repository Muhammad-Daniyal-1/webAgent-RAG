"use client";
import { useState } from "react";
import { apiUrl } from "@/lib/config";

interface Props {
  onCrawlStart: () => void;
  onCrawlReady: (label: string) => void;
}

export default function CrawlInput({ onCrawlStart, onCrawlReady }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function handleCrawl() {
    if (!url.trim()) return;
    setError("");

    try {
      const res = await fetch(apiUrl("/admin/crawl"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), max_pages: 30 }),
      });
      if (!res.ok) throw new Error("Crawl failed");
      onCrawlStart();

      await new Promise((r) => setTimeout(r, 5000));

      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(apiUrl("/status"));
          if (statusRes.status === 404) return;
          const status = await statusRes.json();

          if (status.status === "ready") {
            clearInterval(poll);
            onCrawlReady(url.trim());
          } else if (status.status === "error") {
            clearInterval(poll);
            setError("Crawl failed");
          }
        } catch {
          clearInterval(poll);
          setError("Lost connection to API");
        }
      }, 3000);
    } catch {
      setError("Could not start crawl. Is the backend running?");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
          placeholder="https://yourcompany.com"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                     text-sm text-white placeholder-gray-500 outline-none
                     focus:border-blue-500 transition-colors"
        />
        <button
          onClick={handleCrawl}
          disabled={!url.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                     text-white px-5 py-3 rounded-xl text-sm font-medium
                     transition-colors whitespace-nowrap"
        >
          Crawl Site
        </button>
      </div>
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
    </div>
  );
}
