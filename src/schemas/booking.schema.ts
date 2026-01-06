import * as z from "zod";
import { phoneValidator } from "@/utils/phoneValidator";
import { booking_status } from "generated/prisma";

export const BookingSchema = z.object({
  client_name: z.string().min(1, { error: "Client name is required" }),
  client_surname: z.string().optional(),
  client_phone: z
    .string()
    .refine((val) => phoneValidator(val), { error: "Invalid phone number" }),
  client_email: z.email({ error: "Invalid email address" }).optional(),
  service_name: z.string().optional(),
  start_time: z.date().nullable(),
  duration: z
    .number()
    .min(15, { message: "Duration must be at least 15 minutes" })
    .max(240, { message: "Duration cannot exceed 240 minutes" }),
  price: z
    .number({ message: "The price must be a number" })
    .nonnegative({ error: "Price must be a positive number" })
    .optional(),
  notes: z.string().optional(),
});

export const BookingUpdateSchema = BookingSchema.extend({
  status: z.enum(Object.values(booking_status) as [string, ...string[]], {
    error: "Invalid booking status",
  }),
  totalPaid: z.number().optional(), // hidden field just for validation
}).superRefine((data, ctx) => {
  const totalPaid = data.totalPaid ?? 0; // now accessible

  if (data.price !== undefined && data.price < totalPaid) {
    ctx.addIssue({
      code: "custom",
      message: `Price cannot be lower than already paid amount (${totalPaid}€)`,
      path: ["price"],
    });
  }
});

export type BookingSchemaType = z.infer<typeof BookingSchema>;
export type BookingUpdateSchemaType = z.infer<typeof BookingUpdateSchema>;
