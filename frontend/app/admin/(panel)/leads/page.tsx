"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/api";
import type {
  ContactFormField,
  ContactFormSchema,
  Lead,
  LeadsResponse,
  Message,
} from "@/lib/admin/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/admin/ui";

function fieldLabel(name: string): string {
  const labels: Record<string, string> = {
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    phoneCountry: "Country code",
    region: "Region",
    companyName: "Company",
    companyUrl: "Website",
    subject: "Subject",
    message: "Message",
    name: "Name",
    full_name: "Full name",
  };
  return labels[name] ?? name.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function primaryField(lead: Lead, fields: ContactFormField[]): string {
  const priority = ["email", "name", "full_name", "firstName", "message"];
  for (const key of priority) {
    if (lead.data[key]) return lead.data[key];
  }
  const first = fields.find((f) => lead.data[f.name]);
  return first ? lead.data[first.name] : lead.session_id.slice(0, 12);
}

function LeadStatus({ submitted }: { submitted: boolean }) {
  return submitted ? (
    <Badge variant="success">Form submitted</Badge>
  ) : (
    <Badge variant="warning">Needs follow-up</Badge>
  );
}

function ContactFormDetails({ form }: { form: ContactFormSchema }) {
  return (
    <Card className="p-5 mb-6">
      <h3 className="text-sm font-medium text-zinc-200 mb-4">Contact form</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Form page</p>
          <a
            href={form.form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 break-all"
          >
            {form.form_url}
          </a>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Submit action</p>
          <p className="text-sm text-zinc-300 break-all">{form.action}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Method</p>
          <p className="text-sm text-zinc-300 uppercase">{form.method}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {form.fields.map((field) => (
          <span
            key={field.name}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400"
          >
            <span className="text-zinc-300">{fieldLabel(field.name)}</span>
            <span className="text-zinc-600">·</span>
            <span>{field.type}</span>
            {field.required && (
              <span className="text-indigo-400/80">required</span>
            )}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ConversationLog({
  messages,
  loading,
}: {
  messages: Message[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-sm text-zinc-600 text-center py-8">
        No messages found for this conversation.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex flex-col gap-1.5 ${
            msg.role === "user" ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
      ))}
    </div>
  );
}

export default function LeadsPage() {
  const [response, setResponse] = useState<LeadsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    adminFetch("/admin/leads")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LeadsResponse | null) => {
        setResponse(data);
        if (data?.leads.length) {
          setSelectedId(data.leads[0].session_id);
        }
      });
  }, []);

  const loadConversation = useCallback(async (sessionId: string) => {
    setLoadingChat(true);
    setMessages([]);
    try {
      const res = await adminFetch(`/admin/sessions/${sessionId}`);
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadConversation(selectedId);
  }, [selectedId, loadConversation]);

  const fields = response?.contact_form?.fields ?? [];
  const leads = response?.leads ?? [];
  const selected = leads.find((l) => l.session_id === selectedId) ?? null;

  const fieldNames = useMemo(() => {
    const fromForm = fields.map((f) => f.name);
    const fromData = leads.flatMap((l) => Object.keys(l.data));
    return [...new Set([...fromForm, ...fromData])];
  }, [fields, leads]);

  const submittedCount = leads.filter((l) => l.form_submitted).length;
  const failedCount = leads.length - submittedCount;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Leads captured via chat using your site's contact form fields."
      />

      {!response ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-white/6 bg-white/2 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total leads
              </p>
              <p className="text-3xl font-semibold text-zinc-50 mt-2 tabular-nums">
                {leads.length}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Form submitted
              </p>
              <p className="text-3xl font-semibold text-emerald-400 mt-2 tabular-nums">
                {submittedCount}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Needs follow-up
              </p>
              <p className="text-3xl font-semibold text-amber-400 mt-2 tabular-nums">
                {failedCount}
              </p>
            </Card>
          </div>

          {response.contact_form ? (
            <ContactFormDetails form={response.contact_form} />
          ) : (
            <Card className="px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-zinc-400">
                No contact form detected on your indexed site. Leads will use fields
                collected in chat.
              </p>
              <Link
                href="/admin/knowledge"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
              >
                Re-crawl site →
              </Link>
            </Card>
          )}

          {leads.length === 0 ? (
            <Card className="p-8">
              <EmptyState message="No leads captured yet. They appear here when visitors complete the chat lead flow." />
            </Card>
          ) : (
            <div className="flex flex-col xl:flex-row gap-6 min-h-[60vh]">
              <Card className="xl:w-80 shrink-0 p-3 flex flex-col gap-1 max-h-[80vh] overflow-y-auto">
                {leads.map((lead) => (
                  <button
                    key={lead.session_id}
                    onClick={() => setSelectedId(lead.session_id)}
                    className={`text-left rounded-xl px-4 py-3 transition-all ${
                      selectedId === lead.session_id
                        ? "bg-indigo-500/10 border border-indigo-500/30"
                        : "border border-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {primaryField(lead, fields)}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {new Date(lead.captured_at).toLocaleString()}
                        </p>
                      </div>
                      <LeadStatus submitted={lead.form_submitted} />
                    </div>
                  </button>
                ))}
              </Card>

              <div className="flex-1 flex flex-col gap-6 min-w-0 max-h-[80vh] overflow-y-auto">
                {selected && (
                  <>
                    <Card className="p-6 flex flex-col gap-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-zinc-100">
                            {primaryField(selected, fields)}
                          </h2>
                          <p className="text-xs text-zinc-500 mt-1">
                            Captured {new Date(selected.captured_at).toLocaleString()}
                          </p>
                        </div>
                        <LeadStatus submitted={selected.form_submitted} />
                      </div>

                      {!selected.form_submitted && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
                          The contact form API could not be reached automatically.
                          Use the details below to follow up manually.
                        </div>
                      )}

                      <div>
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
                          Captured fields
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {fieldNames.map((name) => {
                            const value = selected.data[name];
                            if (!value) return null;
                            const fieldMeta = fields.find((f) => f.name === name);
                            return (
                              <div
                                key={name}
                                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                              >
                                <p className="text-xs text-zinc-500 mb-1">
                                  {fieldLabel(name)}
                                  {fieldMeta?.required && (
                                    <span className="text-zinc-600"> · required</span>
                                  )}
                                </p>
                                <p className="text-sm text-zinc-200 break-words whitespace-pre-wrap">
                                  {value}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 flex flex-col gap-4 flex-1 min-h-[320px]">
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <h3 className="text-sm font-medium text-zinc-200">
                          Conversation
                        </h3>
                        <span className="text-xs text-zinc-600 font-mono truncate max-w-[200px]">
                          {selected.session_id.slice(0, 20)}…
                        </span>
                      </div>
                      <ConversationLog messages={messages} loading={loadingChat} />
                    </Card>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
