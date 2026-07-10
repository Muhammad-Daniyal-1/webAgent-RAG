"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminFetch } from "@/lib/admin/api";
import type { Analytics } from "@/lib/admin/types";
import { Card, PageHeader, StatCard } from "@/components/admin/ui";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "rgba(9,9,11,0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fafafa",
};

const CHART_DAYS = 10;

function lastNDayKeys(): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${day}`);
  }
  return keys;
}

function formatDay(day: string) {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function countForDay(
  series: { day: string; count: number }[],
  day: string,
) {
  return series.find((d) => d.day === day)?.count ?? 0;
}

function mergeDailyData(analytics: Analytics) {
  return lastNDayKeys().map((day) => ({
    day: formatDay(day),
    messages: countForDay(analytics.messages_per_day, day),
    sessions: countForDay(analytics.sessions_per_day, day),
    leads: countForDay(analytics.leads_per_day, day),
  }));
}

function DailyAreaChart({
  title,
  data,
  dataKey,
  color,
  gradientId,
}: {
  title: string;
  data: { day: string; [key: string]: string | number }[];
  dataKey: string;
  color: string;
  gradientId: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-600 mb-6">Last {CHART_DAYS} days</p>
      <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
    </Card>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    adminFetch("/admin/analytics")
      .then((res) => (res.ok ? res.json() : null))
      .then(setAnalytics);
  }, []);

  const activityData = analytics ? mergeDailyData(analytics) : [];

  const sessionsChartData = lastNDayKeys().map((day) => ({
    day: formatDay(day),
    sessions: countForDay(analytics?.sessions_per_day ?? [], day),
  }));

  const leadsChartData = lastNDayKeys().map((day) => ({
    day: formatDay(day),
    leads: countForDay(analytics?.leads_per_day ?? [], day),
  }));

  const conversionData = analytics
    ? [
        { name: "Leads", value: analytics.total_leads, fill: "#818cf8" },
        {
          name: "No lead",
          value: Math.max(analytics.total_sessions - analytics.total_leads, 0),
          fill: "#3f3f46",
        },
      ].filter((d) => d.value > 0)
    : [];

  const qualityData = analytics
    ? [
        {
          name: "Grounded",
          value: Math.round(analytics.grounded_rate * 100),
          fill: "#34d399",
        },
        {
          name: "Other",
          value: Math.round((1 - analytics.grounded_rate) * 100),
          fill: "#3f3f46",
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your chatbot performance and engagement."
      />

      {!analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-white/6 bg-white/2 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Sessions"
              value={analytics.total_sessions}
              sub="Total conversations"
            />
            <StatCard
              label="Questions"
              value={analytics.total_questions}
              sub="User messages"
            />
            <StatCard
              label="Leads"
              value={analytics.total_leads}
              sub={`${(analytics.lead_conversion_rate * 100).toFixed(1)}% conversion`}
              accent="#818cf8"
            />
            <StatCard
              label="Grounded"
              value={`${(analytics.grounded_rate * 100).toFixed(0)}%`}
              sub={`Avg ${analytics.avg_retries} retries`}
              accent="#34d399"
            />
          </div>

          {/* Site status banner */}
          <Card className="px-5 py-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  analytics.site_indexed ? "bg-emerald-400" : "bg-zinc-600"
                }`}
              />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {analytics.site_indexed
                    ? "Knowledge base active"
                    : "No site indexed"}
                </p>
                {analytics.site_url && (
                  <p className="text-xs text-zinc-500 truncate max-w-md">
                    {analytics.site_url}
                  </p>
                )}
              </div>
            </div>
            {!analytics.site_indexed && (
              <a
                href="/admin/knowledge"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Add knowledge source →
              </a>
            )}
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Combined daily activity */}
            <Card className="lg:col-span-2 p-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-1">
                Daily activity
              </h3>
              <p className="text-xs text-zinc-600 mb-6">Last {CHART_DAYS} days</p>
              <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f472b6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Area
                      type="monotone"
                      dataKey="messages"
                      name="Messages"
                      stroke="#818cf8"
                      strokeWidth={2}
                      fill="url(#msgGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="sessions"
                      name="Sessions"
                      stroke="#34d399"
                      strokeWidth={2}
                      fill="url(#sessGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#f472b6"
                      strokeWidth={2}
                      fill="url(#leadGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
            </Card>

            {/* Donut charts */}
            <div className="flex flex-col gap-6">
              <Card className="p-6 flex-1">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">
                  Lead conversion
                </h3>
                {conversionData.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-sm text-zinc-600">
                    No sessions yet
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={conversionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={52}
                          dataKey="value"
                          strokeWidth={0}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {conversionData.map((d) => (
                        <div
                          key={d.name}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: d.fill }}
                          />
                          <span className="text-zinc-500">{d.name}</span>
                          <span className="text-zinc-300 font-medium ml-auto">
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-6 flex-1">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">
                  Answer quality
                </h3>
                {qualityData.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-sm text-zinc-600">
                    No answers yet
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie
                          data={qualityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={52}
                          dataKey="value"
                          strokeWidth={0}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {qualityData.map((d) => (
                        <div
                          key={d.name}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: d.fill }}
                          />
                          <span className="text-zinc-500">{d.name}</span>
                          <span className="text-zinc-300 font-medium ml-auto">
                            {d.value}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Sessions & leads per day */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <DailyAreaChart
              title="Sessions per day"
              data={sessionsChartData}
              dataKey="sessions"
              color="#34d399"
              gradientId="sessionsGrad"
            />
            <DailyAreaChart
              title="Leads per day"
              data={leadsChartData}
              dataKey="leads"
              color="#f472b6"
              gradientId="leadsGrad"
            />
          </div>
        </>
      )}
    </>
  );
}
