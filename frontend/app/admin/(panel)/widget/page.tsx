"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import type { WidgetConfigShape } from "@/lib/admin/types";
import { EmbedSnippet } from "@/components/admin/EmbedSnippet";
import { WidgetPreview } from "@/components/admin/WidgetPreview";
import { btnPrimary, Card, Field, inputCls, PageHeader } from "@/components/admin/ui";

export default function WidgetPage() {
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfigShape | null>(null);
  const [widgetMsg, setWidgetMsg] = useState("");
  const [widgetSaving, setWidgetSaving] = useState(false);

  const fetchWidgetConfig = useCallback(async () => {
    const res = await adminFetch("/admin/widget/config");
    if (res.ok) {
      const data = await res.json();
      setWidgetConfig(data.config as WidgetConfigShape);
    }
  }, []);

  useEffect(() => {
    fetchWidgetConfig();
  }, [fetchWidgetConfig]);

  function updateWidgetField<K extends keyof WidgetConfigShape>(
    key: K,
    value: WidgetConfigShape[K],
  ) {
    setWidgetConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSaveWidget() {
    if (!widgetConfig) return;
    setWidgetSaving(true);
    setWidgetMsg("");
    try {
      const res = await adminFetch("/admin/widget/config", {
        method: "PUT",
        body: JSON.stringify({ config: widgetConfig }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setWidgetConfig(data.config as WidgetConfigShape);
      setWidgetMsg("Saved successfully");
    } catch {
      setWidgetMsg("Could not save");
    } finally {
      setWidgetSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Widget"
        description="Customize the chat widget appearance and embed it on your site."
      />

      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-1 max-w-lg flex flex-col gap-4">
          {!widgetConfig ? (
            <Card className="p-6">
              <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
            </Card>
          ) : (
            <Card className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Bot name">
                  <input
                    className={inputCls}
                    value={widgetConfig.bot_name}
                    onChange={(e) => updateWidgetField("bot_name", e.target.value)}
                  />
                </Field>
                <Field label="Header title">
                  <input
                    className={inputCls}
                    value={widgetConfig.title}
                    onChange={(e) => updateWidgetField("title", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Welcome message">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={widgetConfig.welcome_message}
                  onChange={(e) =>
                    updateWidgetField("welcome_message", e.target.value)
                  }
                />
              </Field>

              <Field label="Input placeholder">
                <input
                  className={inputCls}
                  value={widgetConfig.placeholder}
                  onChange={(e) =>
                    updateWidgetField("placeholder", e.target.value)
                  }
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Primary color">
                  <input
                    type="color"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] cursor-pointer"
                    value={widgetConfig.primary_color}
                    onChange={(e) =>
                      updateWidgetField("primary_color", e.target.value)
                    }
                  />
                </Field>
                <Field label="Text color">
                  <input
                    type="color"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] cursor-pointer"
                    value={widgetConfig.text_color}
                    onChange={(e) =>
                      updateWidgetField("text_color", e.target.value)
                    }
                  />
                </Field>
                <Field label="Bubble icon">
                  <input
                    className={inputCls}
                    maxLength={4}
                    value={widgetConfig.bubble_icon}
                    onChange={(e) =>
                      updateWidgetField("bubble_icon", e.target.value)
                    }
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Position">
                  <select
                    className={inputCls}
                    value={widgetConfig.position}
                    onChange={(e) => updateWidgetField("position", e.target.value)}
                  >
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                  </select>
                </Field>
                <Field label="Theme">
                  <select
                    className={inputCls}
                    value={widgetConfig.theme}
                    onChange={(e) => updateWidgetField("theme", e.target.value)}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </Field>
                <Field label="Language">
                  <select
                    className={inputCls}
                    value={widgetConfig.language}
                    onChange={(e) =>
                      updateWidgetField("language", e.target.value)
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                    <option value="ur">Urdu</option>
                  </select>
                </Field>
              </div>

              <Field label="Launcher label (optional)">
                <input
                  className={inputCls}
                  value={widgetConfig.launcher_label}
                  onChange={(e) =>
                    updateWidgetField("launcher_label", e.target.value)
                  }
                />
              </Field>

              <label className="flex items-center gap-2.5 text-sm text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={widgetConfig.show_branding}
                  onChange={(e) =>
                    updateWidgetField("show_branding", e.target.checked)
                  }
                  className="rounded border-white/[0.2] bg-white/[0.04] text-indigo-500 focus:ring-indigo-500/30"
                />
                Show &quot;Powered by&quot; branding
              </label>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveWidget}
                  disabled={widgetSaving}
                  className={btnPrimary}
                >
                  {widgetSaving ? "Saving..." : "Save changes"}
                </button>
                {widgetMsg && (
                  <span
                    className={`text-sm ${
                      widgetMsg.includes("success")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {widgetMsg}
                  </span>
                )}
              </div>
            </Card>
          )}
        </div>

        {widgetConfig && (
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
                Live preview
              </p>
              <WidgetPreview config={widgetConfig} />
            </div>
            <EmbedSnippet />
          </div>
        )}
      </div>
    </>
  );
}
