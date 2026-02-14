import { z } from "zod";

export const ServiceDurationPriceSchema = z.object({
  duration: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z
      .number({ message: "Duration must be a number" })
      .int({ message: "Duration must be a whole number (minutes)" })
      .positive({ message: "Duration must be greater than 0" }),
  ),
  price: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z
      .number({ message: "Price must be a number" })
      .positive({ message: "Price must be greater than 0" }),
  ),
});

export const BaseServiceSchema = z
  .object({
    name: z
      .string()
      .min(1, "Service name is required")
      .max(100, "Service name is too long"),

    short_name: z
      .string()
      .min(1, "Short name is required")
      .max(50, "Short name is too long"),

    notes: z
      .string()
      .max(500, "Notes are too long")
      .optional()
      .or(z.literal("")),

    duration_prices: z
      .array(ServiceDurationPriceSchema)
      .min(1, "At least one duration is required"),
  })

export type BaseServiceSchemaType = z.infer<typeof BaseServiceSchema>;
export type BaseServiceSchemaTypeInput = z.input<typeof BaseServiceSchema>;
export type BaseServiceSchemaTypeOutput = z.output<typeof BaseServiceSchema>;

export type ServiceDurationPriceSchemaType = z.infer<
  typeof ServiceDurationPriceSchema
>;
export type ServiceDurationPriceSchemaTypeInput = z.input<
  typeof ServiceDurationPriceSchema
>;
export type ServiceDurationPriceSchemaTypeOutput = z.output<
  typeof ServiceDurationPriceSchema
>;
