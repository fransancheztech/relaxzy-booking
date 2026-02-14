// app/api/therapists/stream/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const therapists = await prisma.therapists.findMany({
        where: { deleted_at: null },
      });
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(therapists)}\n\n`));

      // Set up a polling loop (or replace with Prisma change streams in future)
      const interval = setInterval(async () => {
        const updated = await prisma.therapists.findMany({
          where: { deleted_at: null },
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(updated)}\n\n`));
      }, 5000); // every 5s

      // Cleanup
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
