import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
  start_time: string; // ISO
  duration?: string; // minutes as string or number
  service_name?: string;
  notes?: string;
  price?: string;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    if (!body.start_time) {
      return NextResponse.json({ error: "Missing start_time" }, { status: 400 });
    }

    if (!body.service_name) {
      return NextResponse.json({ error: "Missing service_name" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 1) FIND OR CREATE CLIENT (only active clients)
    // ------------------------------------------------------
    let client;

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
      const client_name = body.client_name ?? "";
      const client_surname = body.client_surname ?? "";

      client = await prisma.clients.create({
        data: {
          client_name: client_name || null,
          client_surname: client_surname || null,
          client_email: body.client_email ?? null,
          client_phone: body.client_phone ?? null,
        },
      });
    }

    // ------------------------------------------------------
    // 2) FIND SERVICE (only active)
    // ------------------------------------------------------
    const service = await prisma.services.findFirst({
      where: { name: body.service_name, deleted_at: null },
    });

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 3) COMPUTE END TIME
    // ------------------------------------------------------
    const start = new Date(body.start_time);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "Invalid start_time" }, { status: 400 });
    }

    let durationMinutes = 0;

    if (body.duration) {
      durationMinutes = parseInt(String(body.duration), 10) || 0;
    }

    if (!durationMinutes && service.duration != null) {
      const sd = service.duration;
      durationMinutes = sd != null ? parseInt(String(sd), 10) : 0;
    }

    if (!durationMinutes) durationMinutes = 60;

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // ------------------------------------------------------
    // 4) CREATE BOOKING
    // ------------------------------------------------------
    const booking = await prisma.bookings.create({
      data: {
        client_id: client.id,
        service_id: service.id,
        start_time: start,
        end_time: end,
        notes: body.notes ?? null,
        price: body.price,
        status: "confirmed",
      },
    });

    return NextResponse.json({ booking });
  } catch (err) {
    console.error("Create booking error", err);
    return NextResponse.json(
      { error: "Error creating booking" },
      { status: 500 }
    );
  }
}
