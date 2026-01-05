import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
  start_time: string; // ISO
  duration?: string | number; // minutes
  service_name: string;
  notes?: string;
  price?: string | number;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    // ------------------------------------------------------
    // 1) VALIDATE REQUIRED FIELDS
    // ------------------------------------------------------
    if (!body.start_time) return NextResponse.json({ error: "Missing start_time" }, { status: 400 });
    if (!body.service_name) return NextResponse.json({ error: "Missing service_name" }, { status: 400 });
    if (body.duration == null) return NextResponse.json({ error: "Missing duration" }, { status: 400 });
    if (body.price == null) return NextResponse.json({ error: "Missing price" }, { status: 400 });

    // ------------------------------------------------------
    // 2) PARSE & VALIDATE START TIME
    // ------------------------------------------------------
    const start = new Date(body.start_time);
    if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "Invalid start_time" }, { status: 400 });

    // ------------------------------------------------------
    // 3) VALIDATE DURATION (fully flexible)
    // ------------------------------------------------------
    const durationMinutes = Number(body.duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 4) VALIDATE PRICE (fully flexible)
    // ------------------------------------------------------
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 5) FIND OR CREATE CLIENT (allows anonymous walk-ins)
    // ------------------------------------------------------
    let client = null;

    if (body.client_email) {
      client = await prisma.clients.findFirst({
        where: { client_email: body.client_email, deleted_at: null },
      });
    }
    if (!client && body.client_phone) {
      client = await prisma.clients.findFirst({
        where: { client_phone: body.client_phone, deleted_at: null },
      });
    }

    if (!client) {
      client = await prisma.clients.create({
        data: {
          client_name: body.client_name ?? null,
          client_surname: body.client_surname ?? null,
          client_email: body.client_email ?? null,
          client_phone: body.client_phone ?? null,
        },
      });
    }

    // ------------------------------------------------------
    // 6) FIND SERVICE NAME (only active)
    // ------------------------------------------------------
    const serviceName = await prisma.services_names.findFirst({
      where: { name: body.service_name, deleted_at: null },
    });
    if (!serviceName) return NextResponse.json({ error: "Service not found" }, { status: 400 });

    // ------------------------------------------------------
    // 7) COMPUTE END TIME
    // ------------------------------------------------------
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // ------------------------------------------------------
    // 8) CREATE BOOKING
    // ------------------------------------------------------
    const booking = await prisma.bookings.create({
      data: {
        client_id: client.id,
        service_id: serviceName.id,
        start_time: start,
        end_time: end,
        notes: body.notes ?? null,
        price,
        status: "confirmed",
      },
    });

    return NextResponse.json({ booking });
  } catch (err) {
    console.error("Create booking error", err);
    return NextResponse.json({ error: "Error creating booking" }, { status: 500 });
  }
}
