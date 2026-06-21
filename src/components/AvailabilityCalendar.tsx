"use client";

import { useState } from "react";

interface DayAvailability {
  date: string;
  maxCups: number;
  orderedCups: number;
  available: number;
}

interface Props {
  days: DayAvailability[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  pricePerCup: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function AvailabilityCalendar({
  days,
  selectedDate,
  onSelect,
  pricePerCup,
}: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  if (days.length === 0) return null;

  // Group days by month for display
  const months: { label: string; days: DayAvailability[] }[] = [];
  for (const day of days) {
    const d = new Date(day.date + "T00:00:00");
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const last = months[months.length - 1];
    if (!last || last.label !== label) {
      months.push({ label, days: [day] });
    } else {
      last.days.push(day);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">
          Price: <span className="font-semibold text-berry-700">${pricePerCup}</span> per basket
        </p>
        <p className="text-sm text-gray-400">Select an available date to place your order</p>
      </div>

      {months.map(({ label, days: monthDays }) => {
        // Determine the weekday offset for the first day
        const firstDate = new Date(monthDays[0]!.date + "T00:00:00");
        const weekdayOffset = firstDate.getDay(); // 0=Sun

        return (
          <div key={label}>
            <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
              {label}
            </h3>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-gray-400 pb-1"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {/* Offset blank cells */}
              {Array.from({ length: weekdayOffset }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {monthDays.map((day) => {
                const d = new Date(day.date + "T00:00:00");
                const dayNum = d.getDate();
                const isSoldOut = day.available === 0;
                const isSelected = day.date === selectedDate;
                const isHovered = day.date === hoveredDate;

                let cellClass =
                  "relative flex flex-col items-center justify-center rounded-xl p-2 min-h-[64px] border transition-all duration-150 cursor-default select-none";

                if (isSoldOut) {
                  cellClass +=
                    " bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed";
                } else if (isSelected) {
                  cellClass +=
                    " bg-berry-600 border-berry-700 text-white shadow-md cursor-pointer";
                } else if (isHovered) {
                  cellClass +=
                    " bg-berry-50 border-berry-300 text-berry-800 shadow-sm cursor-pointer";
                } else {
                  cellClass +=
                    " bg-white border-gray-200 text-gray-700 hover:border-berry-300 hover:shadow-sm cursor-pointer";
                }

                return (
                  <button
                    key={day.date}
                    disabled={isSoldOut}
                    onClick={() => !isSoldOut && onSelect(day.date)}
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className={cellClass}
                    title={
                      isSoldOut
                        ? "Sold out"
                        : `${day.available} cup${day.available !== 1 ? "s" : ""} available`
                    }
                  >
                    <span className="font-semibold text-sm">{dayNum}</span>
                    {isSoldOut ? (
                      <span className="text-xs mt-0.5 opacity-60">Sold out</span>
                    ) : (
                      <span
                        className={`text-xs mt-0.5 font-medium ${
                          isSelected ? "text-berry-100" : "text-berry-600"
                        }`}
                      >
                        {day.available} left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
