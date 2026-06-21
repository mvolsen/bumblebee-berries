"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DayConfig {
  date: string;
  max_cups: number;
}

interface Props {
  initialPrice: string;
  initialDailyCap: string;
  initialDayConfigs: DayConfig[];
  initialHelperPayRate: string;
  initialScheduleWeeks: string;
  initialScheduleLastDay: string;
  initialScheduleFirstDay: string;
}

export default function AdminSettingsPanel({
  initialPrice,
  initialDailyCap,
  initialDayConfigs,
  initialHelperPayRate,
  initialScheduleWeeks,
  initialScheduleLastDay,
  initialScheduleFirstDay,
}: Props) {
  const router = useRouter();

  // General settings
  const [price, setPrice]                 = useState(initialPrice);
  const [dailyCap, setDailyCap]           = useState(initialDailyCap);
  const [helperPayRate, setHelperPayRate] = useState(initialHelperPayRate);
  const [newPassword, setNewPassword]     = useState("");
  const [saving, setSaving]               = useState(false);
  const [savedMsg, setSavedMsg]           = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Schedule
  const [scheduleWeeks, setScheduleWeeks]         = useState(initialScheduleWeeks);
  const [scheduleFirstDay, setScheduleFirstDay]   = useState(initialScheduleFirstDay);
  const [scheduleLastDay, setScheduleLastDay]     = useState(initialScheduleLastDay);
  const [scheduleSaving, setScheduleSaving]   = useState(false);
  const [scheduleSaved, setScheduleSaved]     = useState(false);
  const [scheduleError, setScheduleError]     = useState<string | null>(null);

  // Day overrides
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideCups, setOverrideCups] = useState("");
  const [dayConfigs, setDayConfigs]     = useState<DayConfig[]>(initialDayConfigs);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const body: Record<string, string> = {
      price_per_cup: price,
      default_daily_cap: dailyCap,
      helper_pay_rate: helperPayRate,
    };
    if (newPassword) body.new_password = newPassword;

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSavedMsg("Settings saved!");
        setNewPassword("");
        router.refresh();
      } else {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Save failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    setScheduleError(null);
    setScheduleSaved(false);

    const weeks = parseInt(scheduleWeeks, 10);
    if (isNaN(weeks) || weeks < 1) {
      setScheduleError("Weeks must be a number greater than 0.");
      setScheduleSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_weeks: String(weeks),
          schedule_first_day: scheduleFirstDay,
          schedule_last_day: scheduleLastDay,
        }),
      });
      if (res.ok) {
        setScheduleSaved(true);
        setTimeout(() => setScheduleSaved(false), 2500);
        router.refresh();
      } else {
        const d = (await res.json()) as { error?: string };
        setScheduleError(d.error ?? "Save failed.");
      }
    } catch {
      setScheduleError("Network error.");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function addOverride() {
    setOverrideError(null);
    if (!overrideDate) {
      setOverrideError("Please select a date.");
      return;
    }
    const cups = parseInt(overrideCups, 10);
    if (isNaN(cups) || cups < 0) {
      setOverrideError("Enter a valid number of baskets (0 or more).");
      return;
    }

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_overrides: [{ date: overrideDate, max_cups: cups }] }),
    });
    if (res.ok) {
      setDayConfigs((prev) => {
        const existing = prev.findIndex((d) => d.date === overrideDate);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { date: overrideDate, max_cups: cups };
          return next;
        }
        return [...prev, { date: overrideDate, max_cups: cups }].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
      });
      setOverrideDate("");
      setOverrideCups("");
      router.refresh();
    }
  }

  async function removeOverride(date: string) {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_overrides: [{ date, max_cups: -1 }] }),
    });
    if (res.ok) {
      setDayConfigs((prev) => prev.filter((d) => d.date !== date));
      router.refresh();
    }
  }

  const today = new Date().toISOString().split("T")[0]!;

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-xl">⚙️</span> General Settings
        </h3>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 mb-4 text-sm">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 mb-4 text-sm">
            {savedMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price per basket ($)
            </label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-3 py-2.5 text-gray-500 text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default daily basket limit
            </label>
            <input
              type="number"
              min="0"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment amount for helpers ($ per basket)
            </label>
            <div className="flex items-center">
              <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-3 py-2.5 text-gray-500 text-sm">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={helperPayRate}
                onChange={(e) => setHelperPayRate(e.target.value)}
                className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Change admin password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="bg-honey-500 hover:bg-honey-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Schedule */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <span className="text-xl">🗓️</span> Schedule
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Controls how far ahead customers can place orders.
        </p>

        {scheduleError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 mb-4 text-sm">
            {scheduleError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of weeks to show on orders page
            </label>
            <input
              type="number"
              min="1"
              max="52"
              value={scheduleWeeks}
              onChange={(e) => setScheduleWeeks(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First &amp; last day to place orders
          </label>
          <div className="flex items-center gap-2">
              <div className="flex items-center flex-1 gap-2">
                <input
                  type="date"
                  value={scheduleFirstDay}
                  onChange={(e) => setScheduleFirstDay(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
                />
                {scheduleFirstDay && (
                  <button
                    onClick={() => setScheduleFirstDay("")}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1 transition-colors"
                    title="Clear first day"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-gray-400 text-sm shrink-0">to</span>
              <div className="flex items-center flex-1 gap-2">
                <input
                  type="date"
                  value={scheduleLastDay}
                  onChange={(e) => setScheduleLastDay(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
                />
                {scheduleLastDay && (
                  <button
                    onClick={() => setScheduleLastDay("")}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1 transition-colors"
                    title="Clear last day"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave either blank for no cutoff.</p>
          </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveSchedule}
            disabled={scheduleSaving}
            className="bg-honey-500 hover:bg-honey-600 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            {scheduleSaving ? "Saving…" : "Save Schedule"}
          </button>
          {scheduleSaved && (
            <span className="text-sm text-green-600 font-medium">Saved!</span>
          )}
        </div>
      </div>

      {/* Per-Day Cup Overrides */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <span className="text-xl">📅</span> Per-Day Basket Overrides
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Override the daily basket limit for specific dates (e.g., set to 0 to
          block a date).
        </p>

        {overrideError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 mb-3 text-sm">
            {overrideError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="date"
            min={today}
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-honey-400"
          />
            <input
            type="number"
            min="0"
            value={overrideCups}
            onChange={(e) => setOverrideCups(e.target.value)}
            placeholder="Max baskets"
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-honey-400"
          />
          <button
            onClick={addOverride}
            className="bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Set Override
          </button>
        </div>

        {dayConfigs.length === 0 ? (
          <p className="text-sm text-gray-400">No per-day overrides set.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {dayConfigs.map((cfg) => (
              <div
                key={cfg.date}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-gray-700">{cfg.date}</span>
                <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-800">
                    {cfg.max_cups} baskets max
                  </span>
                  <button
                    onClick={() => removeOverride(cfg.date)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
