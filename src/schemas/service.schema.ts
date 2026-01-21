import { z } from "zod";

export const ServiceDurationPriceSchema = z.object({
  duration: z
    .number("Duration must be a number")
    .int()
    .positive("Duration must be greater than 0"),

  price: z
    .number("Price must be a number")
    .positive("Price must be greater than 0"),
});

export const BaseServiceSchema = z.object({
  name: z
    .string()
    .min(1, "Service name is required")
    .max(100, "Service name is too long"),

  short_name: z
    .string()
    .max(50, "Short name is too long")
    .optional()
    .or(z.literal("")),

  notes: z
    .string()
    .max(500, "Notes are too long")
    .optional()
    .or(z.literal("")),

  duration_prices: z
    .array(ServiceDurationPriceSchema)
    .min(1, "At least one duration is required"),
});

export type BaseServiceSchemaType = z.infer<typeof BaseServiceSchema>;
export type ServiceDurationPriceSchemaType = z.infer<typeof ServiceDurationPriceSchema>;

