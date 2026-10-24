// app/api/therapists/stream/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (err) {
          console.error("Failed to enqueue SSE event:", err);
        }
      };

      // Subscribe to therapists table changes
      const channel = supabase
        // One channel PER CONNECTION. supabase.channel() returns the existing channel when the
        // name is already in use, so a fixed name made every open tab share one channel: only the
        // first tab ever received events (listeners added after the join never fire), and when
        // any tab closed, removeChannel() cut live updates for all the others.
        .channel(`public:therapists-stream:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "therapists" },
          (payload) => {
            const { eventType, new: newData, old: oldData } = payload;

            if (eventType === "INSERT") {
              send({ type: "INSERT", data: newData });
            } else if (eventType === "UPDATE") {
              if (newData?.deleted_at && !oldData?.deleted_at) {
                send({ type: "DELETE", data: oldData });
              } else {
                send({ type: "UPDATE", data: newData });
              }
            } else if (eventType === "DELETE") {
              send({ type: "DELETE", data: oldData });
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            controller.enqueue(encoder.encode(": connected\n\n"));
          }
        });

      // SSE retry interval
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", async () => {
        await supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
