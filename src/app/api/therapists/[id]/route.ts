import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== "string") return res.status(400).json({ error: "Invalid ID" });

  try {
    if (req.method === "GET") {
      const therapist = await prisma.therapists.findUnique({ where: { id } });
      if (!therapist) return res.status(404).json({ error: "Therapist not found" });
      return res.status(200).json(therapist);
    }

    if (req.method === "PUT") {
      const { full_name, email, phone, notes } = req.body;

      const updated = await prisma.therapists.update({
        where: { id },
        data: { full_name, email, phone, notes },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      await prisma.therapists.delete({ where: { id } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
