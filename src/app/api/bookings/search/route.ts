import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingListItem } from "@/types/bookings";

export async function POST(req: NextRequest) {
  try {
    const { searchTerm } = await req.json();

    if (typeof searchTerm !== "string") {
      return NextResponse.json(
        { error: "Invalid searchTerm" },
        { status: 400 }
      );
    }

    // Query bookings with related client, service, and payments (including payment_events)
    const bookings = await prisma.bookings.findMany({
      where: {
        deleted_at: null,
        OR: [
          { notes: { contains: searchTerm, mode: "insensitive" } },
          {
            clients: {
              OR: [
                { client_name: { contains: searchTerm, mode: "insensitive" } },
                {
                  client_surname: { contains: searchTerm, mode: "insensitive" },
                },
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
        payments: {
          include: { payment_events: true },
        },
      },
      orderBy: { start_time: "desc" },
    });

    // Map response for front-end table
    const data: BookingListItem[] = bookings.map((b) => ({
      id: b.id,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      price: b.price?.toString() ?? null,
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
      payments: b.payments.map((p) => {
        // infer refunded as sum of REFUND events
        const refunded = Math.abs(
          p.payment_events
            .filter((e) => e.type === "REFUND")
            .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
        );

        // infer method from CHARGE event
        const chargeMethods = new Set(
          p.payment_events
            .filter((e) => e.type === "CHARGE")
            .map((e) => e.method)
        );

        const method = chargeMethods.size === 1 ? [...chargeMethods][0] : null;

        return {
          id: p.id,
          amount: p.amount?.toString() ?? "0",
          method,
          refunded: refunded > 0 ? refunded.toString() : null,
          paid_at: p.created_at,
        };
      }),
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
