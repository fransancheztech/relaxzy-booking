import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { previewClientSlot } from "@/lib/clients/resolveBookingClients";

type Body = {
  client_name?: string;
  client_surname?: string;
  client_phone?: string;
  client_email?: string;
  client_picked_id?: string;
};

const text = (v: unknown) => (typeof v === "string" ? v : undefined);

// Read-only: what saving these client fields would do — reuse an existing client, fill in its
// missing phone/email, ask the receptionist, or create a new client. Runs the exact decision code
// the booking and voucher routes save with, so the hint under the fields can't disagree with Save.
export async function POST(request: Request) {
  try {
    const body: Body = await request.json();
    const preview = await previewClientSlot(prisma, {
      client_name: text(body.client_name),
      client_surname: text(body.client_surname),
      client_phone: text(body.client_phone),
      client_email: text(body.client_email),
      client_picked_id: text(body.client_picked_id),
    });
    return NextResponse.json(preview);
  } catch (err) {
    console.error("POST /api/clients/resolve-preview error", err);
    return NextResponse.json({ error: "Error previewing client" }, { status: 500 });
  }
}
