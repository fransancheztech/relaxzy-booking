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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      const channel = supabase
        // One channel PER CONNECTION. supabase.channel() returns the existing channel when the
        // name is already in use, so a fixed name made every open tab share one channel: only the
        // first tab ever received events (listeners added after the join never fire), and when
        // any tab closed, removeChannel() cut live updates for all the others.
        .channel(`public:payments-stream:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "payments" },
          (payload) => {
            const { eventType, new: newData, old: oldData } = payload;

            if (eventType === "INSERT") {
              send({ type: "INSERT", data: newData });
              return;
            }

            if (eventType === "UPDATE") {
              send({ type: "UPDATE", data: newData });
              return;
            }

            if (eventType === "DELETE") {
              send({ type: "DELETE", data: oldData });
              return;
            }
          }
        )
        .subscribe();

      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      req.signal.addEventListener("abort", async () => {
        await supabase.removeChannel(channel);
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
