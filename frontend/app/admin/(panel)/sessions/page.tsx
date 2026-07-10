"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/api";
import type { Message, Session } from "@/lib/admin/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/admin/ui";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    adminFetch("/admin/sessions")
      .then((res) => res.json())
      .then(setSessions);
  }, []);

  async function handleSelectSession(sessionId: string) {
    setSelectedSession(sessionId);
    const res = await adminFetch(`/admin/sessions/${sessionId}`);
    setMessages(await res.json());
  }

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Browse conversation logs and review chatbot responses."
      />

      <div className="flex flex-col lg:flex-row gap-6 min-h-[60vh]">
        {/* Session list */}
        <Card className="lg:w-80 shrink-0 p-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
          {sessions.length === 0 ? (
            <EmptyState message="No sessions yet." />
          ) : (
            sessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() => handleSelectSession(s.session_id)}
                className={`text-left rounded-xl px-4 py-3 transition-all ${
                  selectedSession === s.session_id
                    ? "bg-indigo-500/10 border border-indigo-500/30"
                    : "border border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-400 font-mono truncate">
                    {s.session_id.slice(0, 20)}…
                  </span>
                  {s.lead_captured && <Badge variant="accent">Lead</Badge>}
                </div>
                <div className="text-xs text-zinc-600 mt-1">
                  {new Date(s.created_at).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </Card>

        {/* Message log */}
        <Card className="flex-1 p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {!selectedSession ? (
            <EmptyState message="Select a session to view the conversation." />
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1.5 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-500/20 text-indigo-100 border border-indigo-500/20"
                      : "bg-white/[0.04] text-zinc-200 border border-white/[0.06]"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && (
                  <div className="flex gap-1.5 px-1">
                    {msg.verdict && (
                      <Badge variant={msg.verdict === "pass" ? "success" : "error"}>
                        {msg.verdict}
                      </Badge>
                    )}
                    {msg.mode === "lead_capture" && (
                      <Badge variant="accent">Lead capture</Badge>
                    )}
                    {msg.retries > 0 && (
                      <Badge variant="warning">{msg.retries} retries</Badge>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
