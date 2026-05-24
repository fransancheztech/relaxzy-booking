import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";

const COLUMN_MAP = {
  client_name: Prisma.sql`client_name`,
  client_surname: Prisma.sql`client_surname`,
  client_email: Prisma.sql`client_email`,
  client_phone: Prisma.sql`client_phone`,
} as const;

type FieldKey = keyof typeof COLUMN_MAP;

const isFieldKey = (s: unknown): s is FieldKey =>
  s === "client_name" ||
  s === "client_surname" ||
  s === "client_email" ||
  s === "client_phone";

export async function POST(req: Request) {
  const body = await req.json();

  if (isFieldKey(body.field)) {
    return handlePerField(body);
  }
  return handleLegacy(body);
}

/* -----------------------------------------------------------
   New per-field ranked search
   ----------------------------------------------------------- */
async function handlePerField(body: {
  field: FieldKey;
  value?: string;
  others?: Partial<Record<FieldKey, string>>;
}) {
  const value = (body.value ?? "").trim();
  if (!value) return NextResponse.json([], { status: 200 });

  const focusedCol = COLUMN_MAP[body.field];
  const others = body.others ?? {};

  const overlapExprs: Prisma.Sql[] = [];
  for (const k of Object.keys(COLUMN_MAP) as FieldKey[]) {
    if (k === body.field) continue;
    const v = (others[k] ?? "").trim();
    if (!v) continue;
    overlapExprs.push(
      Prisma.sql`(CASE WHEN ${COLUMN_MAP[k]} ILIKE ${`%${v}%`} THEN 1 ELSE 0 END)`,
    );
  }
  const overlapOrderBy = overlapExprs.length
    ? Prisma.sql`(${Prisma.join(overlapExprs, ` + `)}) DESC,`
    : Prisma.empty;

  try {
    const rows = await prisma.$queryRaw`
      SELECT id, client_name, client_surname, client_email, client_phone,
             client_notes, created_at, updated_at
      FROM clients
      WHERE deleted_at IS NULL
        AND ${focusedCol} ILIKE ${`%${value}%`}
      ORDER BY
        (CASE WHEN LOWER(${focusedCol}) = LOWER(${value}) THEN 2
              WHEN ${focusedCol} ILIKE ${`${value}%`} THEN 1
              ELSE 0 END) DESC,
        ${overlapOrderBy}
        ${focusedCol} ASC NULLS LAST
      LIMIT 15;
    `;
    return NextResponse.json(rows);
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
