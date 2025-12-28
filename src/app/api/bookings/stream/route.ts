import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
);

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      const channel = supabase
        .channel("public:bookings-stream")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
          (payload) => {
            const { eventType, new: newData, old: oldData } = payload;

            if (eventType === "INSERT") {
              send({ type: "INSERT", data: newData });
              return;
            }

            if (eventType === "UPDATE") {
              if (newData?.deleted_at && !oldData?.deleted_at) {
                send({ type: "DELETE", data: oldData });
              } else {
                send({ type: "UPDATE", data: newData });
              }
              return;
            }

            if (eventType === "DELETE") {
              send({ type: "DELETE", data: oldData });
              return;
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            controller.enqueue(encoder.encode(": connected\n\n"));
          }
        });

      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      let isCleaningUp = false;

      const cleanup = async () => {
        if (isCleaningUp) return;
        isCleaningUp = true;

        try {
          await supabase.removeChannel(channel);
        } catch (err) {
          console.error("Error removing Supabase channel:", err);
        }
        // No controller.close() needed!
      };

      // This is sufficient — fires when client disconnects
      _req.signal.addEventListener("abort", cleanup);
    },

    // Optional: handle explicit cancellation of the stream itself
    cancel() {
      // If needed, you could trigger cleanup here too
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