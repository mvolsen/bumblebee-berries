import { NextRequest, NextResponse } from "next/server";
import { createOrderIfAvailable } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// 20 orders per 15 minutes per IP
const ORDER_LIMIT = 20;
const ORDER_WINDOW_MS = 15 * 60 * 1000;

const MAX_NAME_LEN = 100;
const MAX_PHONE_LEN = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    if (!rateLimit(`order:${ip}`, ORDER_LIMIT, ORDER_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      customer_name?: string;
      customer_phone?: string;
      order_date?: string;
      quantity?: number;
    };

    const { customer_name, customer_phone, order_date } = body;

    if (!customer_name || !customer_phone || !order_date) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (customer_name.trim().length === 0 || customer_name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Invalid name." }, { status: 400 });
    }

    if (customer_phone.trim().length === 0 || customer_phone.length > MAX_PHONE_LEN) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    if (!DATE_RE.test(order_date)) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0] as string;
    if (order_date < today) {
      return NextResponse.json({ error: "Cannot order for a past date." }, { status: 400 });
    }

    const rawQty = body.quantity ?? 1;
    const quantity = Math.floor(Number(rawQty));
    if (!isFinite(quantity) || quantity < 1 || quantity > 100) {
      return NextResponse.json({ error: "Invalid quantity." }, { status: 400 });
    }

    // Availability check + insert are atomic — no race condition
    const order = createOrderIfAvailable({
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      order_date,
      quantity,
    });

    if (!order) {
      return NextResponse.json(
        { error: "Not enough baskets available on that date." },
        { status: 409 }
      );
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
