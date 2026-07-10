"use client";
import { useState, useRef, useEffect } from "react";
import { apiUrl } from "@/lib/config";

interface Message {
  role: "user" | "assistant";
  content: string;
  verdict?: string;
  retries?: number;
  suggestContact?: boolean;
  mode?: string;
}

interface Props {
  isReady: boolean;
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  function flushBullets() {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul key={`ul-${key++}`} className="flex flex-col gap-1 my-1 pl-1">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  }

  function renderInline(text: string): React.ReactNode {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="text-white font-semibold">
          {p}
        </strong>
      ) : (
        p
      ),
    );
  }

  for (const line of lines) {
    const t = line.trim();
    if (/^[-*]\s+/.test(t)) {
      bulletBuffer.push(t.replace(/^[-*]\s+/, ""));
    } else {
      flushBullets();
      if (t)
        elements.push(
          <p key={`p-${key++}`} className="leading-relaxed">
            {renderInline(t)}
          </p>,
        );
    }
  }
  flushBullets();

  return <div className="flex flex-col gap-2 text-sm">{elements}</div>;
}

export default function ChatWindow({ isReady }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string>("rag");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateLastAssistant(patch: Partial<Message>) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return next;
    });
  }

  async function sendMessage(overrideText?: string) {
    const question = (overrideText ?? input).trim();
    if (!question || loading || !isReady) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          session_id: sessionId,
        }),
      });

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventMatch = block.match(/^event: (.*)$/m);
          const dataMatch = block.match(/^data: (.*)$/m);
          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "session") {
            if (!sessionId) setSessionId(data.session_id);
          } else if (event === "token") {
            answer += data.text;
            updateLastAssistant({ content: answer });
          } else if (event === "reset") {
            answer = "";
            updateLastAssistant({ content: "" });
          } else if (event === "done") {
            setCurrentMode(data.mode);
            updateLastAssistant({
              verdict: data.verdict,
              retries: data.retries,
              suggestContact: data.suggest_contact,
              mode: data.mode,
            });
          }
        }
      }
    } catch {
      updateLastAssistant({ content: "Error: could not reach the API." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-8">
            {isReady
              ? "Ask anything about the website or document..."
              : "Crawl a website or upload a document above to start"}
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-200 rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                msg.content ? (
                  <FormattedMessage content={msg.content} />
                ) : (
                  <span className="flex gap-1 py-0.5">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )
              ) : (
                msg.content
              )}
            </div>

            {/* Verdict + retry badges */}
            {msg.role === "assistant" && msg.verdict && msg.mode === "rag" && (
              <div className="flex gap-2 px-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    msg.verdict === "pass"
                      ? "bg-green-900 text-green-400"
                      : "bg-red-900 text-red-400"
                  }`}
                >
                  {msg.verdict === "pass" ? "✓ grounded" : "✗ ungrounded"}
                </span>
                {msg.retries !== undefined && msg.retries > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-400 font-medium">
                    {msg.retries} {msg.retries === 1 ? "retry" : "retries"}
                  </span>
                )}
              </div>
            )}

            {/* Contact prompt — shown after relevant answers */}
            {msg.role === "assistant" && msg.suggestContact && (
              <div className="max-w-[88%] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex flex-col gap-2">
                <p className="text-xs text-gray-400">
                  Would you like to get in touch with them?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendMessage("I want to contact them")}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Yes, connect me
                  </button>
                  <button
                    onClick={() => sendMessage("No thanks")}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Not right now
                  </button>
                </div>
              </div>
            )}

            {/* Lead capture mode indicator */}
            {msg.role === "assistant" && msg.mode === "lead_capture" && (
              <div className="flex items-center gap-1.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-xs text-purple-400">
                  collecting your details
                </span>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={
            currentMode === "lead_capture"
              ? "Type your answer..."
              : isReady
                ? "Ask a question..."
                : "Crawl a site or upload a file first"
          }
          disabled={!isReady || loading}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                     text-sm text-white placeholder-gray-500 outline-none
                     focus:border-blue-500 disabled:opacity-40 transition-colors"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!isReady || loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                     text-white px-5 py-3 rounded-xl text-sm font-medium
                     transition-colors disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
