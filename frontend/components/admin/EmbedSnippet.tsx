"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/config";
import { Card, btnGhost } from "./ui";

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${API_BASE_URL}/widget.js"\n        data-api-url="${API_BASE_URL}"\n        async></script>`;

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-200 text-sm">Embed on your site</h3>
        <button
          onClick={() => {
            navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className={btnGhost}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Paste this snippet just before <code className="text-zinc-400">&lt;/body&gt;</code> on any website.
      </p>
      <pre className="rounded-xl border border-white/[0.06] bg-black/30 p-4 text-xs text-zinc-400 overflow-x-auto whitespace-pre font-mono">
        {snippet}
      </pre>
    </Card>
  );
}
