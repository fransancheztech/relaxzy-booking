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

            // ------------------------------
            // SOFT DELETE TRANSLATION LOGIC
            // ------------------------------

            // Real INSERT
            if (eventType === "INSERT") {
              send({ type: "INSERT", data: newData });
              return;
            }

            // Real UPDATE
            if (eventType === "UPDATE") {
              // If deleted_at was set => treat as DELETE
              if (newData?.deleted_at && !oldData?.deleted_at) {
                send({ type: "DELETE", data: oldData });
              } else {
                send({ type: "UPDATE", data: newData });
              }
              return;
            }

            // Real DELETE (should not happen anymore but we leave it)
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

      let isClosed = false;

      const close = async () => {
        if (isClosed) return;
        isClosed = true;

        await supabase.removeChannel(channel);
        controller.close();
      };

      _req.signal.addEventListener("abort", close);
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
