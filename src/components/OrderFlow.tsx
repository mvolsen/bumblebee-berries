"use client";

import { useState } from "react";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BumblebeeLogo from "@/components/BumblebeeLogo";
import Link from "next/link";
import { calcPricing, formatTotal } from "@/lib/pricing";

interface DayAvailability {
  date: string;
  maxCups: number;
  orderedCups: number;
  available: number;
}

interface Props {
  days: DayAvailability[];
  pricePerCup: string;
}

type Step = "calendar" | "form" | "confirm" | "success";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function OrderFlow({ days, pricePerCup }: Props) {
  const [step, setStep] = useState<Step>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: number;
    order_date: string;
    quantity: number;
  } | null>(null);

  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;
  const maxCups = selectedDay?.available ?? 0;
  const { freeCups, chargedCups, total } = calcPricing(quantity, pricePerCup);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setQuantity(1);
    setStep("form");
  }

  function handleQuantityChange(delta: number) {
    setQuantity((q) => Math.min(maxCups, Math.max(1, q + delta)));
  }

  function validate() {
    const errs: Partial<typeof form> = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) setStep("confirm");
  }

  async function handleConfirm() {
    if (!selectedDate) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.name,
          customer_phone: form.phone,
          order_date: selectedDate,
          quantity,
        }),
      });
      const data = (await res.json()) as {
        id?: number;
        error?: string;
        order_date?: string;
        quantity?: number;
      };
      if (!res.ok) {
        setServerError(data.error ?? "Something went wrong. Please try again.");
        setStep("form");
      } else {
        setConfirmedOrder({
          id: data.id!,
          order_date: data.order_date!,
          quantity: data.quantity!,
        });
        setStep("success");
      }
    } catch {
      setServerError("Network error. Please try again.");
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-honey-50 to-berry-50">
      {/* Nav */}
      <nav className="bg-honey-400 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <BumblebeeLogo size={36} />
            <span className="font-display text-lg font-bold text-honey-900">
              Bumblebee Berries
            </span>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Promo banner */}
        <div className="bg-honey-400 text-honey-900 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3 shadow-sm">
          <span className="text-2xl">🎁</span>
            <p className="font-semibold text-sm">
            Buy 6 baskets, get 1 free!{" "}
            <span className="font-normal">Every 7th basket is on us.</span>
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["calendar", "form", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step === s || (step === "success" && s === "confirm")
                    ? "bg-berry-600 text-white"
                    : ["form", "confirm"].indexOf(step) > i || step === "success"
                    ? "bg-berry-200 text-berry-700"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  step === s ? "text-berry-700 font-medium" : "text-gray-400"
                }`}
              >
                {s === "calendar" ? "Pick a Date" : s === "form" ? "Your Info" : "Confirm"}
              </span>
              {i < 2 && <div className="w-8 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Step 1: Calendar */}
          {step === "calendar" && (
            <>
              <h1 className="font-display text-2xl font-bold text-berry-800 mb-6 text-center">
                Choose a Pickup Date
              </h1>
              <AvailabilityCalendar
                days={days}
                selectedDate={selectedDate}
                onSelect={handleDateSelect}
                pricePerCup={pricePerCup}
              />
            </>
          )}

          {/* Step 2: Form */}
          {step === "form" && selectedDate && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-2xl font-bold text-berry-800">
                  Your Details
                </h1>
                <button
                  onClick={() => setStep("calendar")}
                  className="text-sm text-berry-600 hover:underline"
                >
                  ← Change date
                </button>
              </div>

              {/* Date + quantity summary */}
              <div className="bg-berry-50 border border-berry-200 rounded-xl px-4 py-4 mb-6 space-y-3">
                <p className="text-sm text-berry-700">
                  <span className="font-semibold">Pickup date:</span>{" "}
                  {formatDate(selectedDate)}
                    {selectedDay && (
                    <span className="ml-2 text-berry-500 text-xs">
                      ({selectedDay.available} baskets available)
                    </span>
                  )}
                </p>

                {/* Quantity picker */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-berry-700">Baskets:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-full border border-berry-300 text-berry-700 font-bold text-lg flex items-center justify-center hover:bg-berry-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold text-gray-800 text-lg">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= maxCups}
                      className="w-8 h-8 rounded-full border border-berry-300 text-berry-700 font-bold text-lg flex items-center justify-center hover:bg-berry-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pricing breakdown */}
                <PricingSummary
                  quantity={quantity}
                  freeCups={freeCups}
                  chargedCups={chargedCups}
                  total={total}
                  pricePerCup={pricePerCup}
                />
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <Field
                  label="Full Name"
                  id="name"
                  value={form.name}
                  error={errors.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Jane Smith"
                />
                <Field
                  label="Phone"
                  id="phone"
                  type="tel"
                  value={form.phone}
                  error={errors.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="(555) 123-4567"
                />

                <button
                  type="submit"
                  className="w-full bg-berry-600 hover:bg-berry-700 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
                >
                  Review Order
                </button>
              </form>
            </>
          )}

          {/* Step 3: Confirm */}
          {step === "confirm" && selectedDate && (
            <>
              <h1 className="font-display text-2xl font-bold text-berry-800 mb-6 text-center">
                Confirm Your Order
              </h1>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden mb-4">
                <Row label="Pickup Date" value={formatDate(selectedDate)} />
                <Row
                  label="Baskets"
                  value={
                    freeCups > 0
                      ? `${quantity} baskets (${freeCups} free!)`
                      : `${quantity} basket${quantity !== 1 ? "s" : ""}`
                  }
                />
                <Row
                  label="Total"
                  value={`$${formatTotal(total)} (pay at pickup)`}
                />
                <Row label="Name" value={form.name} />
                <Row label="Phone" value={form.phone} />
              </div>

              {freeCups > 0 && (
                <div className="bg-honey-50 border border-honey-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-honey-800 flex items-center gap-2">
                  <span>🎁</span>
                  <span>
                    You're getting <strong>{freeCups} free basket{freeCups !== 1 ? "s" : ""}</strong> with
                    this order!
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Edit
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="flex-1 bg-berry-600 hover:bg-berry-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {submitting ? "Placing order…" : "Place Order"}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Success */}
          {step === "success" && confirmedOrder && (
            <div className="text-center py-6">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="font-display text-2xl font-bold text-berry-800 mb-2">
                Order Confirmed!
              </h1>
                <p className="text-gray-600 mb-1">
                Thanks, {form.name}! Your order is placed.
              </p>
              <p className="text-gray-600 mb-6">
                We'll see you on{" "}
                <strong>{formatDate(confirmedOrder.order_date)}</strong> with{" "}
                <strong>
                  {confirmedOrder.quantity} basket
                  {confirmedOrder.quantity !== 1 ? "s" : ""}
                </strong>{" "}
                of raspberries.
              </p>

              <div className="bg-honey-50 border border-honey-200 rounded-xl px-5 py-4 text-sm text-honey-800 mb-6">
                {(() => {
                  const { freeCups: fc, chargedCups: cc, total: t } = calcPricing(
                    confirmedOrder.quantity,
                    pricePerCup
                  );
                  return (
                    <>
                      {fc > 0 && (
                        <p className="font-semibold text-honey-700 mb-1">
                          🎁 Includes {fc} free basket{fc !== 1 ? "s" : ""}!
                        </p>
                      )}
                      <p>
                        Bring{" "}
                        <strong>
                          ${formatTotal(t)}
                        </strong>{" "}
                        ({cc} basket{cc !== 1 ? "s" : ""} × ${pricePerCup}) at pickup.
                      </p>
                    </>
                  );
                })()}
              </div>

              <Link
                href="/"
                className="inline-block bg-berry-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-berry-700 transition-colors"
              >
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PricingSummary({
  quantity,
  freeCups,
  chargedCups,
  total,
  pricePerCup,
}: {
  quantity: number;
  freeCups: number;
  chargedCups: number;
  total: number;
  pricePerCup: string;
}) {
  const nextFreeAt = 7 - (quantity % 7);
  const showNextFreeHint = freeCups === 0 && quantity < 7;

  return (
    <div className="text-sm">
          <div className="flex justify-between items-baseline">
        <span className="text-berry-700">
          {quantity} basket{quantity !== 1 ? "s" : ""}
          {freeCups > 0 && (
            <span className="ml-2 text-green-600 font-semibold">
              ({freeCups} free!)
            </span>
          )}
        </span>
        <span className="font-bold text-gray-800 text-base">
          ${total.toFixed(2)}
        </span>
      </div>
      {freeCups > 0 ? (
        <p className="text-xs text-gray-500 mt-0.5">
          Paying for {chargedCups} × ${pricePerCup}
        </p>
        ) : showNextFreeHint ? (
        <p className="text-xs text-honey-700 mt-0.5">
          Add {nextFreeAt} more basket{nextFreeAt !== 1 ? "s" : ""} to get 1 free!
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  value,
  error,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-berry-400 ${
          error
            ? "border-red-400 bg-red-50"
            : "border-gray-300 focus:border-berry-400"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="text-gray-800 text-right">{value}</span>
    </div>
  );
}
