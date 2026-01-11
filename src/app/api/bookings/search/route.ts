import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { searchTerm } = await req.json();

    if (typeof searchTerm !== "string") {
      return NextResponse.json({ error: "Invalid searchTerm" }, { status: 400 });
    }

    // Query bookings with related client and service details
    const bookings = await prisma.bookings.findMany({
      where: {
        deleted_at: null, // exclude soft-deleted bookings
        OR: [
          { notes: { contains: searchTerm, mode: "insensitive" } },
          {
            clients: {
              OR: [
                { client_name: { contains: searchTerm, mode: "insensitive" } },
                { client_surname: { contains: searchTerm, mode: "insensitive" } },
                { client_email: { contains: searchTerm, mode: "insensitive" } },
                { client_phone: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          {
            services_names: {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { short_name: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
      include: {
        clients: true,
        services_names: true,
        payments: true,
      },
      orderBy: { start_time: "desc" },
      take: 50, // limit to first 50 results
    });

    // Map response for front-end table
    const data = bookings.map((b) => ({
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      price: b.price,
      notes: b.notes,
      client: b.clients
        ? {
            id: b.clients.id,
            name: b.clients.client_name,
            surname: b.clients.client_surname,
            email: b.clients.client_email,
            phone: b.clients.client_phone,
          }
        : null,
      service: b.services_names
        ? {
            id: b.services_names.id,
            name: b.services_names.name,
            short_name: b.services_names.short_name,
          }
        : null,
      payments: b.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        paid: p.paid,
        refunded: p.refunded,
        paid_at: p.paid_at,
      })),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
