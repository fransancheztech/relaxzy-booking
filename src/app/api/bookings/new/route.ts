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

const normalize = (v?: string) =>
  v && v.trim() !== "" ? v.trim() : null;


export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    // ------------------------------------------------------
    // 1) VALIDATE REQUIRED FIELDS
    // ------------------------------------------------------
    if (!body.start_time)
      return NextResponse.json(
        { error: "Missing start_time" },
        { status: 400 }
      );
    if (body.duration == null)
      return NextResponse.json({ error: "Missing duration" }, { status: 400 });

    // ------------------------------------------------------
    // 2) PARSE & VALIDATE START TIME
    // ------------------------------------------------------
    const start = new Date(body.start_time);
    if (Number.isNaN(start.getTime()))
      return NextResponse.json(
        { error: "Invalid start_time" },
        { status: 400 }
      );

    // ------------------------------------------------------
    // 3) VALIDATE DURATION (fully flexible)
    // ------------------------------------------------------
    const durationMinutes = Number(body.duration);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    }

    // ------------------------------------------------------
    // 4) VALIDATE PRICE (nullable)
    // ------------------------------------------------------
    let price: number | null = null;

    if (body.price !== undefined && body.price !== null && body.price !== "") {
      const parsedPrice = Number(body.price);

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }

      price = parsedPrice;
    }

    // ------------------------------------------------------
    // 5) FIND OR CREATE CLIENT (allows anonymous walk-ins)
    // ------------------------------------------------------
    let clientId: string | null = null;

    const hasClientInfo =
      body.client_name ||
      body.client_email ||
      body.client_phone ||
      body.client_surname;

    if (hasClientInfo) {
      // Only create/find client if info is provided
      if (!body.client_name) throw new Error("Client name is required");
      if (!body.client_email && !body.client_phone)
        throw new Error("Provide at least a phone or email for the client");

      // find by email first
      if (body.client_email) {
        const client = await prisma.clients.findFirst({
          where: { client_email: body.client_email, deleted_at: null },
        });
        clientId = client?.id ?? null;
      }
      if (!clientId && body.client_phone) {
        const client = await prisma.clients.findFirst({
          where: { client_phone: body.client_phone, deleted_at: null },
        });
        clientId = client?.id ?? null;
      }

      if (!clientId) {
        const client = await prisma.clients.create({
          data: {
            client_name: body.client_name,
            client_surname: normalize(body.client_surname),
            client_email: normalize(body.client_email),
            client_phone: normalize(body.client_phone),
          },
        });
        clientId = client.id;
      }
    }

    // ------------------------------------------------------
    // 6) SERVICE (nullable)
    // ------------------------------------------------------
    let serviceId: string | null = null;

    if (body.service_name && body.service_name.trim() !== "") {
      const service = await prisma.services_names.findFirst({
        where: { name: body.service_name, deleted_at: null },
      });

      if (!service) {
        return NextResponse.json(
          { error: "Service not found" },
          { status: 400 }
        );
      }

      serviceId = service.id;
    }

    // ------------------------------------------------------
    // 7) COMPUTE END TIME
    // ------------------------------------------------------
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // ------------------------------------------------------
    // 8) CREATE BOOKING
    // ------------------------------------------------------
    const booking = await prisma.bookings.create({
      data: {
        client_id: clientId, // can be null
        service_id: serviceId, // can be null
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
    return NextResponse.json(
      { error: "Error creating booking" },
      { status: 500 }
    );
  }
}
