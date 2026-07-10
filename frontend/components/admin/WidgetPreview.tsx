import type { WidgetConfigShape } from "@/lib/admin/types";

export function WidgetPreview({ config }: { config: WidgetConfigShape }) {
  const isLight = config.theme === "light";
  const panelBg = isLight ? "#ffffff" : "#0b1220";
  const panelText = isLight ? "#111827" : "#e5e7eb";
  const botBubble = isLight ? "#f1f5f9" : "#1f2937";

  return (
    <div className="relative h-[460px] rounded-2xl border border-white/[0.06] bg-zinc-950/50 overflow-hidden">
      <div
        className="absolute w-[300px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          bottom: 84,
          [config.position === "bottom-left" ? "left" : "right"]: 16,
          background: panelBg,
          color: panelText,
        }}
      >
        <div
          className="px-4 py-3 font-semibold text-sm"
          style={{ background: config.primary_color, color: config.text_color }}
        >
          {config.title}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div
            className="self-start max-w-[80%] rounded-2xl px-3 py-2 text-sm"
            style={{ background: botBubble, color: panelText }}
          >
            {config.welcome_message}
          </div>
          <div
            className="self-end max-w-[80%] rounded-2xl px-3 py-2 text-sm"
            style={{
              background: config.primary_color,
              color: config.text_color,
            }}
          >
            Hello!
          </div>
        </div>
        <div className="p-2 border-t" style={{ borderColor: botBubble }}>
          <div
            className="rounded-full px-3 py-2 text-xs"
            style={{
              background: botBubble,
              color: isLight ? "#6b7280" : "#9ca3af",
            }}
          >
            {config.placeholder}
          </div>
        </div>
        {config.show_branding && (
          <div className="text-center text-[10px] py-1 opacity-50">
            Powered by WebAgent RAG
          </div>
        )}
      </div>

      <div
        className="absolute flex items-center gap-2"
        style={{
          bottom: 16,
          [config.position === "bottom-left" ? "left" : "right"]: 16,
        }}
      >
        {config.launcher_label && config.position === "bottom-right" && (
          <span
            className="text-xs px-3 py-1.5 rounded-full shadow"
            style={{ background: panelBg, color: panelText }}
          >
            {config.launcher_label}
          </span>
        )}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
          style={{ background: config.primary_color, color: config.text_color }}
        >
          {config.bubble_icon}
        </div>
      </div>
    </div>
  );
}
