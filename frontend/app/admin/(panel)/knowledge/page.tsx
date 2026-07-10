"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch, adminUpload } from "@/lib/admin/api";
import type { Site } from "@/lib/admin/types";
import {
  Badge,
  btnPrimary,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/admin/ui";

export default function KnowledgePage() {
  const router = useRouter();
  const [site, setSite] = useState<Site | null>(null);
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlStatus, setCrawlStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSite = useCallback(async () => {
    const res = await adminFetch("/admin/site");
    if (res.status === 401) {
      router.push("/admin");
      return;
    }
    if (res.status === 404 || res.status === 204) {
      setSite(null);
      return;
    }
    setSite(await res.json());
  }, [router]);

  useEffect(() => {
    fetchSite();
  }, [fetchSite]);

  async function handleCrawl() {
    if (!crawlUrl.trim()) return;
    setLoading(true);
    setCrawlStatus("Starting crawl...");
    try {
      const res = await adminFetch("/admin/crawl", {
        method: "POST",
        body: JSON.stringify({ url: crawlUrl.trim(), max_pages: 30 }),
      });
      if (!res.ok) throw new Error("Crawl failed");
      setCrawlStatus("Crawling in progress...");

      const poll = setInterval(async () => {
        const statusRes = await adminFetch("/admin/status");
        if (statusRes.status === 404) return;
        const status = await statusRes.json();
        if (status.status === "ready") {
          clearInterval(poll);
          setCrawlStatus(
            `Done — ${status.pages_crawled} pages, ${status.chunks_indexed} chunks`,
          );
          setCrawlUrl("");
          setLoading(false);
          fetchSite();
        } else if (status.status === "error") {
          clearInterval(poll);
          setCrawlStatus("Crawl failed");
          setLoading(false);
        }
      }, 3000);
    } catch {
      setCrawlStatus("Error starting crawl");
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await adminUpload("/admin/upload", form);
    const data = await res.json();
    setCrawlStatus(data.message);
    fetchSite();
  }

  async function handleDeleteSite() {
    if (!confirm("Delete the indexed site and clear all vectors?")) return;
    await adminFetch("/admin/site", { method: "DELETE" });
    setSite(null);
  }

  async function handleSetSchedule(hours: number) {
    await adminFetch("/admin/site/schedule", {
      method: "PATCH",
      body: JSON.stringify({ refresh_interval_hours: hours }),
    });
    fetchSite();
  }

  const statusVariant =
    site?.status === "ready"
      ? "success"
      : site?.status === "processing"
        ? "accent"
        : "error";

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="Crawl a website or upload documents to power your chatbot."
      />

      <div className="flex flex-col gap-6">
        <Card className="p-6 flex flex-col gap-5">
          <h2 className="text-sm font-medium text-zinc-200">Add source</h2>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
              placeholder="https://company.com"
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
            />
            <button
              onClick={handleCrawl}
              disabled={loading || !crawlUrl.trim()}
              className={btnPrimary}
            >
              {loading ? "Crawling..." : "Crawl website"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-zinc-600 text-xs">or upload a file</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <label className="flex items-center justify-center border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl py-8 cursor-pointer transition-colors group">
            <div className="text-center">
              <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                Drop PDF or TXT here, or click to browse
              </p>
              <p className="text-xs text-zinc-600 mt-1">Max one file at a time</p>
            </div>
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={handleUpload}
            />
          </label>

          {crawlStatus && (
            <p
              className={`text-sm ${
                crawlStatus.startsWith("Done")
                  ? "text-emerald-400"
                  : crawlStatus.includes("failed") || crawlStatus.includes("Error")
                    ? "text-red-400"
                    : "text-indigo-400"
              }`}
            >
              {crawlStatus}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">Indexed source</h2>
          {!site ? (
            <EmptyState message="No knowledge source indexed yet." />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-sm font-medium text-zinc-100 truncate">
                  {site.url}
                </span>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span>{site.pages_crawled} pages</span>
                  <span>{site.chunks_indexed} chunks</span>
                  {site.has_contact_form && (
                    <span className="text-emerald-500">Contact form detected</span>
                  )}
                  <span>
                    Added {new Date(site.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!site.url.startsWith("file://") && (
                  <select
                    title="Auto re-crawl interval"
                    value={site.refresh_interval_hours}
                    onChange={(e) => handleSetSchedule(Number(e.target.value))}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-400 outline-none focus:border-indigo-500/50"
                  >
                    <option value={0}>No refresh</option>
                    <option value={24}>Daily</option>
                    <option value={168}>Weekly</option>
                    <option value={720}>Monthly</option>
                  </select>
                )}
                <Badge variant={statusVariant}>{site.status}</Badge>
                <button
                  onClick={handleDeleteSite}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
