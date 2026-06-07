import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

const FIELDS = ["client_name", "client_surname", "client_email", "client_phone"] as const;
type FieldKey = (typeof FIELDS)[number];

const isFieldKey = (s: unknown): s is FieldKey =>
  typeof s === "string" && (FIELDS as readonly string[]).includes(s);

export async function POST(req: Request) {
  const body = await req.json();

  if (isFieldKey(body.field)) {
    return handlePerField(body);
  }
  return handleLegacy(body);
}

/* -----------------------------------------------------------
   New per-field ranked search.
   Filters on the focused field, then ranks in JS (exact > prefix > contains,
   tie-broken by how many of the other typed fields also overlap). Done in JS
   rather than raw SQL so it doesn't depend on fragile raw-query composition.
   ----------------------------------------------------------- */
async function handlePerField(body: {
  field: FieldKey;
  value?: string;
  others?: Partial<Record<FieldKey, string>>;
}) {
  const field = body.field;
  const value = (body.value ?? "").trim();
  if (!value) return NextResponse.json([], { status: 200 });

  const others = body.others ?? {};

  try {
    const rows = await prisma.clients.findMany({
      where: {
        deleted_at: null,
        [field]: { contains: value, mode: "insensitive" },
      },
      select: {
        id: true,
        client_name: true,
        client_surname: true,
        client_email: true,
        client_phone: true,
        client_notes: true,
        created_at: true,
        updated_at: true,
      },
      take: 50,
    });

    const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();
    const valLc = value.toLowerCase();

    const focusedScore = (row: (typeof rows)[number]) => {
      const f = lc(row[field]);
      if (f === valLc) return 2;
      if (f.startsWith(valLc)) return 1;
      return 0;
    };

    const overlapScore = (row: (typeof rows)[number]) => {
      let s = 0;
      for (const k of FIELDS) {
        if (k === field) continue;
        const v = (others[k] ?? "").trim().toLowerCase();
        if (v && lc(row[k]).includes(v)) s += 1;
      }
      return s;
    };

    const ranked = rows
      .map((row) => ({ row, fs: focusedScore(row), os: overlapScore(row) }))
      .sort(
        (a, b) =>
          b.fs - a.fs ||
          b.os - a.os ||
          lc(a.row[field]).localeCompare(lc(b.row[field])),
      )
      .slice(0, 15)
      .map((r) => r.row);

    return NextResponse.json(ranked);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error finding clients" }, { status: 500 });
  }
}

/* -----------------------------------------------------------
   Legacy OR-across-fields search (used by useSimilarClients)
   ----------------------------------------------------------- */
async function handleLegacy(body: {
  client_name?: string;
  client_surname?: string;
  client_email?: string;
  client_phone?: string;
}) {
  const { client_name, client_surname, client_email, client_phone } = body;

  if (!client_name && !client_surname && !client_email && !client_phone) {
    return NextResponse.json([], { status: 200 });
  }

  const filters: Prisma.clientsWhereInput[] = [];
  if (client_name) filters.push({ client_name: { contains: client_name, mode: "insensitive" } });
  if (client_surname) filters.push({ client_surname: { contains: client_surname, mode: "insensitive" } });
  if (client_email) filters.push({ client_email: { contains: client_email, mode: "insensitive" } });
  if (client_phone) filters.push({ client_phone: { contains: client_phone, mode: "insensitive" } });

  try {
    const clients = await prisma.clients.findMany({
      where: { AND: [{ deleted_at: null }, { OR: filters }] },
      select: {
        id: true,
        client_name: true,
        client_surname: true,
        client_email: true,
        client_phone: true,
        client_notes: true,
        created_at: true,
        updated_at: true,
      },
      take: 15,
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error finding clients" }, { status: 500 });
  }
}
