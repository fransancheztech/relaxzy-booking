// INTERNAL USE ONLY – expects fully validated booking payload

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // ------------------------------------------------------
    // Optional: Validate client exists and is not deleted
    // ------------------------------------------------------
    if (data.client_id) {
      const client = await prisma.clients.findFirst({
        where: {
          id: data.client_id,
          deleted_at: null,
        },
      });

      if (!client) {
        return NextResponse.json(
          { error: "Client not found or deleted" },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------------
    // Optional: Validate service exists (services_names)
    // ------------------------------------------------------
    if (data.service_id) {
      const serviceName = await prisma.services_names.findFirst({
        where: {
          id: data.service_id,
          deleted_at: null,
        },
      });

      if (!serviceName) {
        return NextResponse.json(
          { error: "Service not found or deleted" },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------------
    // Create booking
    // ------------------------------------------------------
    const booking = await prisma.bookings.create({ data });

    return NextResponse.json(booking);
  } catch (err: any) {
    console.error("Error creating booking:", err);
    return NextResponse.json(
      { error: "Error creating booking", details: err.message },
      { status: 500 }
    );
  }
}
