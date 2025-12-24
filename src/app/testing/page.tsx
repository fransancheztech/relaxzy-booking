'use client';

import { Button, Container, InputAdornment, TextField } from '@mui/material';
import React, { useState } from 'react';
import MoneyIcon from '@mui/icons-material/Money';

const page = () => {
    const [inputValue, setInputValue] = useState('Probando');

    return (
        <TextField
            sx={{ borderRadius: '5px', marginTop: '1rem' }}
            size='medium'
            type='text'
            label={
                <Container style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Cash <MoneyIcon />
                </Container>
            }
            variant='outlined'
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            slotProps={{
                input: {
                    sx: {
                        '& input': {
                            textAlign: 'center'
                        }
                    },
                    startAdornment: (
                        <InputAdornment position='start'>
                            <Button
                                variant='contained'
                                color='error'
                                size='small'
                                sx={{ minWidth: 0, px: 1.5, py: 0.5, textTransform: 'none' }}>
                                Refund
                            </Button>
                        </InputAdornment>
                    ),
                    endAdornment: (
                        <InputAdornment position='end'>
                            <Button
                                variant='contained'
                                color='success'
                                size='small'
                                sx={{ minWidth: 0, px: 1.5, py: 0.5, textTransform: 'none' }}>
                                Pay
                            </Button>
                        </InputAdornment>
                    )
                }
            }}
        />
    );
};

export default page;
