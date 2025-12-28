import { ClientRow } from '@/hooks/useSimilarClients';
import { BookingSchemaType } from '@/schemas/booking.schema';
import { BookingModel } from '@/types/bookings';
import { Button, Container, Typography } from '@mui/material';
import { UseFormSetValue } from 'react-hook-form';

type ClientSearchProps = {
    setValue: UseFormSetValue<BookingSchemaType>
    clients: ClientRow[];
    loading: boolean;
    error?: string;
};

const ClientSearch = ({ setValue, clients, loading, error }: ClientSearchProps) => {
    const handlePickClient = (c: ClientRow) => {
        setValue(
            'client_name',
            c.client_name ?? ''
        );
        setValue(
            'client_surname',
            c.client_surname ?? ''
        );
        setValue(
            'client_email',
            c.client_email ?? ''
        );
        setValue(
            'client_phone',
            c.client_phone ?? ''
        );
    };

    return (
        <>
            {loading && <Typography variant='body2'>Searching...</Typography>}
            {error && <Typography color='error'>{error}</Typography>}
            {clients.length > 0 && (
                <Container sx={{ mt: 2 }}>
                    <Typography variant='subtitle2'>Possible existing clients:</Typography>
                    {clients.map((c) => (
                        <Button key={c.id} onClick={() => handlePickClient(c)} sx={{ textTransform: 'none' }}>
                            {`${c.client_name ?? ''} ${c.client_surname ?? ''}`.trim()} – {c.client_phone || c.client_email}
                        </Button>
                    ))}
                </Container>
            )}
        </>
    );
};

export default ClientSearch;
