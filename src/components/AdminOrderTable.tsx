"use client";

import { useState } from "react";
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

interface Props {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  pricePerCup: string;
  onStatusChange: (order: Order, newStatus: "pending" | "fulfilled") => void;
  invCups: number;
}

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function AdminOrderTable({ orders, setOrders, pricePerCup, invCups, onStatusChange }: Props) {
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled">("pending");
  const [toggling, setToggling] = useState<Set<number>>(new Set());

  async function toggleStatus(order: Order) {
    const newStatus = order.status === "pending" ? "fulfilled" : "pending";
    setToggling((s) => new Set(s).add(order.id));
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
        );
        onStatusChange(order, newStatus);
      }
    } finally {
      setToggling((s) => {
        const next = new Set(s);
        next.delete(order.id);
        return next;
      });
    }
  }

  const filtered  = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const pending   = orders.filter((o) => o.status === "pending");
  const fulfilled = orders.filter((o) => o.status === "fulfilled");

  return (
    <div>
      {/* Summary chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <Chip
          label={`All (${orders.length})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
          color="gray"
        />
        <Chip
          label={`Pending (${pending.length})`}
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
          color="yellow"
        />
        <Chip
          label={`Fulfilled (${fulfilled.length})`}
          active={filter === "fulfilled"}
          onClick={() => setFilter("fulfilled")}
          color="green"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p>No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Pickup Date</th>
                <th className="px-4 py-3 font-medium">Baskets</th>
                <th className="px-4 py-3 font-medium">Amount Due</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((order) => {
                const { freeCups, chargedCups, total } = calcPricing(
                  order.quantity,
                  pricePerCup
                );
                return (
                  <tr
                    key={order.id}
                    className={`transition-colors ${
                      order.status === "fulfilled"
                        ? "bg-green-50/40"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-400">#{order.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {order.customer_phone}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span>{order.quantity}</span>
                      {freeCups > 0 && (
                        <span className="ml-1 text-xs text-green-600 font-medium">
                          ({freeCups} free)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      ${total.toFixed(2)}
                      {freeCups > 0 && (
                        <div className="text-xs text-gray-400 font-normal">
                          {chargedCups} × ${pricePerCup}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "fulfilled"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {order.status === "fulfilled" ? "Fulfilled" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const canFulfill = order.status !== "pending" || invCups >= order.quantity;
                        return (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => toggleStatus(order)}
                              disabled={toggling.has(order.id) || !canFulfill}
                              title={!canFulfill ? `Not enough baskets on hand (need ${order.quantity}, have ${invCups})` : undefined}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                order.status === "pending"
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                              }`}
                            >
                              {toggling.has(order.id)
                                ? "…"
                                : order.status === "pending"
                                ? "Mark Fulfilled"
                                : "Mark Pending"}
                            </button>
                            {order.status === "pending" && !canFulfill && (
                              <span className="text-xs text-red-500">
                                Need {order.quantity}, have {invCups}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: "gray" | "yellow" | "green";
}) {
  const base =
    "px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors";
  const colorMap = {
    gray: active
      ? "bg-gray-700 text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
    yellow: active
      ? "bg-yellow-500 text-white"
      : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    green: active
      ? "bg-green-600 text-white"
      : "bg-green-100 text-green-700 hover:bg-green-200",
  };
  return (
    <button className={`${base} ${colorMap[color]}`} onClick={onClick}>
      {label}
    </button>
  );
}
