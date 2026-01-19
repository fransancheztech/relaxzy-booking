import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingListItem } from "@/types/bookings";
import { Prisma } from "generated/prisma";

export async function POST(req: NextRequest) {
  try {
    const { page, limit, searchTerm, sort } = await req.json();

    if (typeof searchTerm !== "string") {
      return NextResponse.json(
        { error: "Invalid searchTerm" },
        { status: 400 }
      );
    }

    const where: Prisma.bookingsWhereInput = {
  deleted_at: null,
};

    if (searchTerm) {
  where.OR = [
    {
      notes: { contains: searchTerm, mode: "insensitive" },
    },
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
  ];
}

    // Query bookings with related client, service, and payments (including payment_events)
    const [rows, total] = await Promise.all([
      prisma.bookings.findMany({
      where,
      include: {
        clients: true,
        services_names: true,
        payments: {
          include: { payment_events: true },
        },
      },
      skip: page * limit,
      take: limit,
      orderBy: {
        [sort?.field ?? "start_time"]: sort?.sort ?? "desc",
      },
    }),
    prisma.bookings.count({where})
  ])

    // Map response for front-end table
    const data: BookingListItem[] = rows.map((b) => ({
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      price: b.price?.toString() ?? null,
      notes: b.notes,
      created_at: b.created_at,
      updated_at: b.updated_at,
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
      payments: b.payments.map((p) => {
        // infer refunded as sum of REFUND events
        const refunded = Math.abs(
          p.payment_events
            .filter((e) => e.type === "REFUND")
            .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
        );

        return {
          id: p.id,
          amount: p.amount?.toString() ?? "0",
          refunded: refunded > 0 ? refunded.toString() : null,
          created_at: p.created_at,
        };
      }),
    }));

    // Return mapped rows (frontend expects `client` and `service` keys)
    return NextResponse.json({ rows: data, total });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
