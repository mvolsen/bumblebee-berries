"use client";

import React, { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

interface Helper {
  id: number;
  name: string;
  phone: string;
  cups_picked: number;
  amount_paid: number;
  created_at: string;
}

interface Props {
  helpers: Helper[];
  setHelpers: Dispatch<SetStateAction<Helper[]>>;
  helperPayRate: number;
  onCupsAdjust: (delta: 1 | -1) => void;
}

export default function AdminHelpersPanel({ helpers, setHelpers, helperPayRate, onCupsAdjust }: Props) {
  const [newName, setNewName]   = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding]     = useState(false);

  // Inline-edit state: maps helper id → draft values
  const [edits, setEdits]       = useState<Record<number, { cups: string; owed: string; paid: string }>>({});
  const [saving, setSaving]     = useState<Set<number>>(new Set());
  const [stepping, setStepping] = useState<Set<number>>(new Set());

  async function addHelper() {
    setAddError(null);
    if (!newName.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/helpers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const helper = (await res.json()) as Helper;
        setHelpers((prev) => [...prev, helper].sort((a, b) => a.name.localeCompare(b.name)));
        setNewName("");
      } else {
        const d = (await res.json()) as { error?: string };
        setAddError(d.error ?? "Failed to add helper.");
      }
    } catch {
      setAddError("Network error.");
    } finally {
      setAdding(false);
    }
  }

  async function adjustCups(h: Helper, delta: 1 | -1) {
    const newCups = Math.max(0, h.cups_picked + delta);
    if (newCups === h.cups_picked) return;

    // Optimistic updates for both helper cups and inventory
    setHelpers((prev) =>
      prev.map((x) => x.id === h.id ? { ...x, cups_picked: newCups } : x)
    );
    onCupsAdjust(delta);

    setStepping((s) => new Set(s).add(h.id));
    try {
      await fetch(`/api/admin/helpers/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cups_picked: newCups }),
      });
    } finally {
      setStepping((s) => {
        const next = new Set(s);
        next.delete(h.id);
        return next;
      });
    }
  }

  function startEdit(h: Helper) {
    const owed = Math.max(0, h.cups_picked * helperPayRate - h.amount_paid);
    setEdits((prev) => ({
      ...prev,
      [h.id]: {
        cups: String(h.cups_picked),
        paid: String(h.amount_paid),
        owed: owed.toFixed(2),
      },
    }));
  }

  function cancelEdit(id: number) {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(h: Helper) {
    const draft = edits[h.id];
    if (!draft) return;
    const cups_picked = parseInt(draft.cups, 10);
    const amount_paid = parseFloat(draft.paid);
    if (isNaN(cups_picked) || cups_picked < 0) return;
    if (isNaN(amount_paid) || amount_paid < 0) return;

    setSaving((s) => new Set(s).add(h.id));
    try {
      const res = await fetch(`/api/admin/helpers/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cups_picked, amount_paid }),
      });
      if (res.ok) {
        setHelpers((prev) =>
          prev.map((x) => x.id === h.id ? { ...x, cups_picked, amount_paid } : x)
        );
        cancelEdit(h.id);
      }
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(h.id);
        return next;
      });
    }
  }

  async function payout(h: Helper) {
    const owed = Math.max(0, h.cups_picked * helperPayRate - h.amount_paid);
    if (owed === 0) return;
    const amount_paid = h.amount_paid + owed;
    setSaving((s) => new Set(s).add(h.id));
    try {
      const res = await fetch(`/api/admin/helpers/${h.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_paid }),
      });
      if (res.ok) {
        setHelpers((prev) =>
          prev.map((x) => x.id === h.id ? { ...x, amount_paid } : x)
        );
      }
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(h.id);
        return next;
      });
    }
  }

  const totalCupsPicked = helpers.reduce((s, h) => s + h.cups_picked, 0);
  const totalPaid       = helpers.reduce((s, h) => s + h.amount_paid, 0);
  const totalOwed       = helpers.reduce((s, h) => s + Math.max(0, h.cups_picked * helperPayRate - h.amount_paid), 0);

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Helpers"  value={String(helpers.length)}       emoji="🧑‍🌾" />
        <SummaryCard label="Baskets Picked"    value={String(totalCupsPicked)}       emoji={<img src="/raspberry.png" alt="raspberry" className="w-7 h-7" />}  highlight="berry" />
        <SummaryCard label="Total Owed"     value={`$${totalOwed.toFixed(2)}`}    emoji="🧾"  highlight="yellow" />
        <SummaryCard label="Total Paid Out" value={`$${totalPaid.toFixed(2)}`}    emoji="💵"  highlight="green" />
      </div>

      {/* Add helper */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-xl">➕</span> Add Helper
        </h3>

        {addError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 mb-3 text-sm">
            {addError}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHelper()}
            placeholder="Name *"
            className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-honey-400 focus:border-honey-400"
          />
          <button
            onClick={addHelper}
            disabled={adding}
            className="bg-honey-500 hover:bg-honey-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            {adding ? "Adding…" : "Add Helper"}
          </button>
        </div>
      </div>

      {/* Helpers table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <h3 className="font-semibold text-gray-800 px-6 pt-5 pb-4 flex items-center gap-2 border-b border-gray-100">
          <span className="text-xl">🧑‍🌾</span> Volunteer Helpers
        </h3>

        {helpers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="mb-2"><img src="/raspberry.png" alt="raspberry" className="w-9 h-9 mx-auto" /></p>
            <p>No helpers signed up yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Baskets Picked</th>
                  <th className="px-4 py-3 font-medium">Amount Owed</th>
                  <th className="px-4 py-3 font-medium">Amount Paid</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {helpers.map((h) => {
                  const draft      = edits[h.id];
                  const isEditing  = !!draft;
                  const isSaving   = saving.has(h.id);
                  const isStepping = stepping.has(h.id);

                  const draftCups  = isEditing ? (parseInt(draft.cups, 10) || 0) : h.cups_picked;
                  const draftPaid  = isEditing ? (parseFloat(draft.paid) || 0)  : h.amount_paid;
                  const amountOwed = isEditing
                    ? Math.max(0, parseFloat(draft.owed) || 0)
                    : Math.max(0, draftCups * helperPayRate - draftPaid);

                  return (
                    <tr key={h.id} className={`transition-colors ${isEditing ? "bg-honey-50" : "bg-white hover:bg-gray-50"}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{h.name}</td>

                      {/* Cups picked */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={draft.cups}
                            onChange={(e) => {
                              const cups = e.target.value;
                              const newOwed = Math.max(0, (parseInt(cups, 10) || 0) * helperPayRate - (parseFloat(draft.paid) || 0));
                              const newPaid = Math.max(0, (parseInt(cups, 10) || 0) * helperPayRate - newOwed);
                              setEdits((prev) => ({ ...prev, [h.id]: { ...draft, cups, owed: newOwed.toFixed(2), paid: newPaid.toFixed(2) } }));
                            }}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-honey-400"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => adjustCups(h, -1)}
                              disabled={isStepping || h.cups_picked === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-600 font-bold text-sm transition-colors"
                              aria-label="Remove one basket"
                            >
                              −
                            </button>
                            <span className={`font-semibold text-berry-700 w-6 text-center tabular-nums ${isStepping ? "opacity-50" : ""}`}>
                              {h.cups_picked}
                            </span>
                            <button
                              onClick={() => adjustCups(h, 1)}
                              disabled={isStepping}
                              className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 text-gray-600 font-bold text-sm transition-colors"
                              aria-label="Add one basket"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Amount owed */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center">
                            <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-2 py-1.5 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.owed}
                              onChange={(e) => {
                                const owed = e.target.value;
                                const newPaid = Math.max(0, (parseInt(draft.cups, 10) || 0) * helperPayRate - (parseFloat(owed) || 0));
                                setEdits((prev) => ({ ...prev, [h.id]: { ...draft, owed, paid: newPaid.toFixed(2) } }));
                              }}
                              className="w-24 border border-gray-300 rounded-r-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-honey-400"
                            />
                          </div>
                        ) : (
                          <span className={`font-semibold ${amountOwed > 0 ? "text-orange-600" : "text-gray-400"}`}>
                            ${amountOwed.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Amount paid */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center">
                            <span className="bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg px-2 py-1.5 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.paid}
                              onChange={(e) => {
                                const paid = e.target.value;
                                const newOwed = Math.max(0, (parseInt(draft.cups, 10) || 0) * helperPayRate - (parseFloat(paid) || 0));
                                setEdits((prev) => ({ ...prev, [h.id]: { ...draft, paid, owed: newOwed.toFixed(2) } }));
                              }}
                              className="w-24 border border-gray-300 rounded-r-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-honey-400"
                            />
                          </div>
                        ) : (
                          <span className="font-semibold text-green-700">${h.amount_paid.toFixed(2)}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(h)}
                              disabled={isSaving}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {isSaving ? "…" : "Save"}
                            </button>
                            <button
                              onClick={() => cancelEdit(h.id)}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(h)}
                              className="bg-honey-100 hover:bg-honey-200 text-honey-800 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => payout(h)}
                              disabled={isSaving || amountOwed === 0}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {isSaving ? "…" : "Payout"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emoji,
  highlight,
}: {
  label: string;
  value: string;
  emoji: React.ReactNode;
  highlight?: "berry" | "green" | "yellow";
}) {
  const colorMap: Record<string, string> = {
    berry:  "border-berry-300 bg-berry-50",
    green:  "border-green-300 bg-green-50",
    yellow: "border-yellow-300 bg-yellow-50",
  };
  const base = "rounded-2xl border p-5 bg-white shadow-sm";
  const cls  = highlight ? `${base} ${colorMap[highlight]}` : base;

  return (
    <div className={cls}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
