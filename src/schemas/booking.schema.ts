import * as z from 'zod';
import { phoneValidator } from '@/utils/phoneValidator';

export const BookingSchema = z.object({
    client_name: z.string().min(1, { error: 'Client name is required' }),
    client_surname: z.string().optional(),
    client_phone: z.string().refine((val) => phoneValidator(val), { error: 'Invalid phone number' }),
    client_email: z.email({ error: 'Invalid email address' }).optional(),
    start_time: z.date().nullable(),
    service_name: z.string().optional(),
    duration: z.number()
        .min(15, { message: 'Duration must be at least 15 minutes' })
        .max(240, { message: 'Duration cannot exceed 240 minutes' }),
    price: z.number().min(0, { error: 'Price must be a positive number' }).optional(),
    notes: z.string().optional()
})

export type BookingSchemaType = z.infer<typeof BookingSchema>;

export const BookingUpdateSchema = BookingSchema.extend({
    status: z.enum(['pending', 'confirmed', 'canceled'], { error: 'Invalid booking status' }),
    paidCash: z.coerce.number<number>({ error: "Paid in card must be a number" }).nonnegative({ error: 'paidCard must be a positive number' }),
    paidCard: z.coerce.number<number>({ error: "Paid in card must be a number" }).nonnegative({ error: 'paidCard must be a positive number' })
}).superRefine((data, ctx) => {
    console.log("SUPER REFINE RUNNING", data);
    const paidCash = Number(data.paidCash || 0);
    const paidCard = Number(data.paidCard || 0);
    const totalPaid = paidCash + paidCard;

    if (data.price === undefined && totalPaid > 0) {
        ctx.addIssue({
            code: 'custom',
            message: 'Cannot register payments without a price',
            path: ['form'],
        });
        return;
    }

    if (data.price !== undefined && totalPaid > data.price) {
        ctx.addIssue({
            code: 'custom',
            message: 'The payments cannot exceed the total price',
            path: ['form'],
        });
    }
});

export type BookingUpdateSchemaType = z.infer<typeof BookingUpdateSchema>;



