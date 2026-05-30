import * as z from "zod";
import { phoneValidator } from "@/utils/phoneValidator";
import { booking_status } from "generated/prisma";

export const CompanionSchema = z
  .object({
    service_name: z.string().optional(),
    therapist_id: z.string().optional(),
    duration: z
      .number({ message: "Duration must be a number" })
      .min(15, { message: "Duration must be at least 15 minutes" })
      .max(240, { message: "Duration cannot exceed 240 minutes" }),
    price: z
      .number({ message: "The price must be a number" })
      .nonnegative({ message: "Price must be a positive number" })
      .optional(),
    notes: z.string().optional(),
    cashPayment: z.number().nonnegative().optional(),
    cardPayment: z.number().nonnegative().optional(),
    voucherPayment: z.number().nonnegative().optional(),
    voucherCode: z.string().optional(),
    same_as_primary: z.boolean().optional(),
    client_name: z.string().optional(),
    client_surname: z.string().optional(),
    client_phone: z
      .string()
      .optional()
      .refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
      }),
    client_email: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim() === "" || z.email().safeParse(val).success,
        { message: "Invalid email address" },
      ),
  })
  .superRefine((data, ctx) => {
    if (data.same_as_primary) return;
    if (!data.client_name || data.client_name.trim() === "") {
      ctx.addIssue({
        code: "custom",
        message: "Companion name is required (or enable 'Same client as primary')",
        path: ["client_name"],
      });
    }
  });

export type CompanionSchemaType = z.infer<typeof CompanionSchema>;

export const BookingSchema = z
  .object({
    client_name: z.string().optional(),
    client_surname: z.string().optional(),
    client_phone: z
      .string()
      .optional()
      .refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
      }),
    client_email: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim() === "" || z.email().safeParse(val).success,
        { message: "Invalid email address" },
      ),
    service_name: z.string().optional(),
    therapist_id: z.string().optional(),
    start_time: z
      .date()
      .nullable()
      .refine((v) => v !== null, { message: "Date & time is required" }),
    duration: z
      .number({ message: "Duration must be a number" })
      .min(15, { message: "Duration must be at least 15 minutes" })
      .max(240, { message: "Duration cannot exceed 240 minutes" }),
    price: z
      .number({ message: "The price must be a number" })
      .nonnegative({ error: "Price must be a positive number" })
      .refine((val) => Number.isInteger(val * 100), {
        message: "Price must have at most 2 decimal places",
      })
      .optional(),
    notes: z.string().optional(),
    therapist_requested: z.boolean().optional(),
    cashPayment: z.number().nonnegative().optional(),
    cardPayment: z.number().nonnegative().optional(),
    voucherPayment: z.number().nonnegative().optional(),
    voucherCode: z.string().optional(),
    companions: z.array(CompanionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // ------------------------------
    // CLIENT VALIDATION
    // ------------------------------
    const hasAnyClientInfo = !!(
      data.client_name ||
      data.client_surname ||
      data.client_email ||
      data.client_phone
    );

    if (hasAnyClientInfo) {
      // Case: identified client → must have name + (phone or email)
      if (!data.client_name) {
        ctx.addIssue({
          code: "custom",
          message: "Client name is required if identifying a client",
          path: ["client_name"],
        });
      }
      if (!data.client_email && !data.client_phone) {
        ctx.addIssue({
          code: "custom",
          message: "Provide at least a phone or email for the client",
          path: ["booking_creation_form"],
        });
      }
    }
  });

export const BookingUpdateSchema = BookingSchema.safeExtend({
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
