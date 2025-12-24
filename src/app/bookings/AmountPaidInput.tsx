import { BookingModel } from '@/types/bookings';
import { handleInputChange } from '@/utils/create-booking-handlers';
import {
  Grid,
  TextField,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import PaymentsIcon from '@mui/icons-material/Payments';
import React, { useState } from 'react';

type AmountPaidInputProps = {
  moneyType: 'paidCard' | 'paidCash';
  value: number | string | undefined;
  setFormData: React.Dispatch<React.SetStateAction<BookingModel>>;
};

const AmountPaidInput: React.FC<AmountPaidInputProps> = ({
  moneyType,
  value = "",
  setFormData,
}) => {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const label =
    moneyType === 'paidCard' ? 'Paid by Card' : 'Paid in Cash';

  const Icon =
    moneyType === 'paidCard' ? CreditCardIcon : PaymentsIcon;

  const handleConfirm = () => {
    setFormData(prev => ({
      ...prev,
      [moneyType]: Number(tempValue),
    }));
    setOpen(false);
  };

  return (
    <>
      <Grid size={6}>
        <TextField
          size="small"
          label={label}
          variant="outlined"
          value={value}
          fullWidth
          slotProps={{
            input: {
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setOpen(true)} edge="end">
                    <Icon />
                  </IconButton>
                </InputAdornment>
              ),
            }
          }}
        />
      </Grid>

      {/* Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{label}</DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            type="number"
            label="Amount (€)"
            fullWidth
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AmountPaidInput;
