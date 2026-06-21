"use client";

import React, { useState } from "react";
import AdminOrderTable from "@/components/AdminOrderTable";
import AdminSettingsPanel from "@/components/AdminSettingsPanel";
import AdminHelpersPanel from "@/components/AdminHelpersPanel";
import AdminSchedulePanel from "@/components/AdminSchedulePanel";
import { calcPricing } from "@/lib/pricing";

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  order_date: string;
  quantity: number;
  status: "pending" | "fulfilled";
  created_at: string;
}

interface DayConfig {
  date: string;
  max_cups: number;
}

interface Helper {
  id: number;
  name: string;
  phone: string;
  cups_picked: number;
  amount_paid: number;
  created_at: string;
}

interface ScheduleAssignment {
  id: number;
  date: string;
  helper_id: number;
  helper_name: string;
}

interface Props {
  initialOrders: Order[];
  pricePerCup: string;
  initialPrice: string;
  initialDailyCap: string;
  initialDayConfigs: DayConfig[];
  initialHelpers: Helper[];
  inventoryCups: string;
  initialHelperPayRate: string;
  initialScheduleWeeks: string;
  initialScheduleLastDay: string;
  initialScheduleFirstDay: string;
  initialAssignments: ScheduleAssignment[];
}

type Tab = "orders" | "helpers" | "schedule" | "settings";

const TABS: { id: Tab; label: string; emoji: React.ReactNode }[] = [
  { id: "orders",   label: "Orders & Inventory", emoji: "📦" },
  { id: "helpers",  label: "Helpers",             emoji: <img src="/raspberry.png" alt="raspberry" className="w-4 h-4 inline-block" /> },
  { id: "schedule", label: "Schedule",            emoji: "📅" },
  { id: "settings", label: "Settings",            emoji: "⚙️" },
];

export default function AdminTabs({
  initialOrders,
  pricePerCup,
  initialPrice,
  initialDailyCap,
  initialDayConfigs,
  initialHelpers,
  inventoryCups,
  initialHelperPayRate,
  initialScheduleWeeks,
  initialScheduleLastDay,
  initialScheduleFirstDay,
  initialAssignments,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [orders, setOrders]           = useState<Order[]>(initialOrders);
  const [helpers, setHelpers]         = useState<Helper[]>(initialHelpers);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>(initialAssignments);
  const [invCups, setInvCups]         = useState(parseInt(inventoryCups, 10) || 0);

  // Live-computed stats
  const pending          = orders.filter((o) => o.status === "pending");
  const fulfilled        = orders.filter((o) => o.status === "fulfilled");
  const pendingCount     = pending.length;
  const fulfilledCount   = fulfilled.length;
  const pendingCups      = pending.reduce((s, o) => s + o.quantity, 0);
  const totalRevenue     = fulfilled
    .reduce((s, o) => s + calcPricing(o.quantity, pricePerCup).total, 0)
    .toFixed(2);
  const pendingRevenue   = pending
    .reduce((s, o) => s + calcPricing(o.quantity, pricePerCup).total, 0)
    .toFixed(2);

  function adjustInventory(delta: number) {
    setInvCups((prev) => {
      const next = Math.max(0, prev + delta);
      fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_cups: String(next) }),
      });
      return next;
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex gap-1" aria-label="Admin tabs">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                  active
                    ? "border-honey-500 text-honey-700 bg-honey-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === "orders" && (
        <div className="space-y-8">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Orders"       value={String(orders.length)} emoji="📋" />
            <StatCard label="Pending"            value={String(pendingCount)}  emoji="⏳" highlight="yellow" />
            <StatCard label="Fulfilled"          value={String(fulfilledCount)} emoji="✅" highlight="green" />
            <StatCard label="Revenue Collected"  value={`$${totalRevenue}`}   emoji="💰" highlight="berry"
              sub={`$${pendingRevenue} pending`} />
          </div>

          {/* Inventory */}
          <InventorySection
            invCups={invCups}
            setInvCups={setInvCups}
            pendingCups={pendingCups}
          />

          {/* Orders table */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Orders</h2>
            <AdminOrderTable
              orders={orders}
              setOrders={setOrders}
              pricePerCup={pricePerCup}
              invCups={invCups}
              onStatusChange={(order, newStatus) => {
                if (newStatus === "fulfilled") {
                  adjustInventory(-order.quantity);
                } else {
                  adjustInventory(order.quantity);
                }
              }}
            />
          </section>
        </div>
      )}

      {activeTab === "helpers" && (
        <AdminHelpersPanel
          helpers={helpers}
          setHelpers={setHelpers}
          helperPayRate={parseFloat(initialHelperPayRate) || 2.50}
          onCupsAdjust={(delta) => adjustInventory(delta)}
        />
      )}

      {activeTab === "schedule" && (
        <AdminSchedulePanel
          helpers={helpers}
          assignments={assignments}
          setAssignments={setAssignments}
          scheduleLastDay={initialScheduleLastDay}
        />
      )}

      {activeTab === "settings" && (
        <section>
          <AdminSettingsPanel
            initialPrice={initialPrice}
            initialDailyCap={initialDailyCap}
            initialDayConfigs={initialDayConfigs}
            initialHelperPayRate={initialHelperPayRate}
            initialScheduleWeeks={initialScheduleWeeks}
            initialScheduleLastDay={initialScheduleLastDay}
            initialScheduleFirstDay={initialScheduleFirstDay}
          />
        </section>
      )}
    </div>
  );
}

// ── Inventory section ─────────────────────────────────────────────────────────

function InventorySection({
  invCups,
  setInvCups,
  pendingCups,
}: {
  invCups: number;
  setInvCups: (n: number) => void;
  pendingCups: number;
}) {
  const [inputVal, setInputVal] = useState(String(invCups));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onHand  = invCups;
  const balance = onHand - pendingCups;

  async function save() {
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory_cups: String(n) }),
    });
    setInvCups(n);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Inventory</h2>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 bg-berry-50 rounded-xl border border-berry-200">
            <div className="text-3xl font-bold text-berry-700">{onHand}</div>
            <div className="text-sm text-berry-600 mt-1">Baskets on hand</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <div className="text-3xl font-bold text-yellow-700">{pendingCups}</div>
            <div className="text-sm text-yellow-600 mt-1">Committed to pending orders</div>
          </div>
          <div className={`text-center p-4 rounded-xl border ${
            balance >= 0
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}>
            <div className={`text-3xl font-bold ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
              {balance >= 0 ? "+" : ""}{balance}
            </div>
            <div className={`text-sm mt-1 ${balance >= 0 ? "text-green-600" : "text-red-500"}`}>
              {balance >= 0 ? "Surplus" : "Shortfall"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">
            Update baskets on hand:
          </label>
          <input
            type="number"
            min="0"
            value={inputVal}
            onChange={(e) => { setInputVal(e.target.value); setSaved(false); }}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="bg-honey-500 hover:bg-honey-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </div>
    </section>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  emoji,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
  highlight?: "yellow" | "green" | "berry";
}) {
  const colorMap: Record<string, string> = {
    yellow: "border-yellow-300 bg-yellow-50",
    green:  "border-green-300 bg-green-50",
    berry:  "border-berry-300 bg-berry-50",
  };
  const base = "rounded-2xl border p-5 bg-white shadow-sm";
  const cls  = highlight ? `${base} ${colorMap[highlight]}` : base;

  return (
    <div className={cls}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
