import * as z from 'zod';
import { phoneValidator } from '@/utils/phoneValidator';

export const BookingSchema = z.object({
    client_name: z.string().min(1, { error: 'Client name is required' }),
    client_surname: z.string(),
    client_phone: z.string().refine((val) => phoneValidator(val), {error: 'Invalid phone number' }),
    client_email: z.email(),
    start_time: z.date(),
    duration: z.number().min(15, { error: 'Duration must be at least 15 minutes' }).max(240, { error: 'Duration cannot exceed 240 minutes' }),
    service_name: z.string(),
    notes: z.string(),
    price: z.number().min(0, { error: 'Price must be a positive number' })
})

export type BookingSchemaType = z.infer<typeof BookingSchema>;

export const BookingUpdateSchema = BookingSchema.extend({
    status: z.enum(['pending', 'confirmed', 'canceled']),
    paidCash: z.number().min(0),
    paidCard: z.number().min(0)
}).superRefine((data, ctx) => {
    const totalPaid = data.paidCash + data.paidCard;

    if (totalPaid > data.price) {
        ctx.addIssue({
            code: "custom",
            message: 'The sum of paidCash and paidCard cannot be more than the total price',
            path: [],
        });
    }
});

export type BookingUpdateSchemaType = z.infer<typeof BookingUpdateSchema>;



