import { handleInputChange } from '@/utils/create-booking-handlers';
import {
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    Radio,
    RadioGroup,
    TextField,
    Typography,
    Autocomplete
} from '@mui/material';
import { useState } from 'react';
import { BusinessDatePicker, BusinessDateTimePicker } from '@/components/BusinessDatePickers';

type GridFormElementProps<T> = {
    type: string;
    size: number | { [key: string]: number };
    formData: T;
    setFormData: React.Dispatch<React.SetStateAction<T>>;
    formKey: keyof T;
    elements?: string[];
    text?: string;
    label?: string;
    filesMax?: number;
    autoFocus?: boolean;
    showTime?: boolean;
    isDisabled?: boolean;
};

export function GridFormElement<T>({
    type,
    size,
    formData,
    setFormData,
    formKey,
    elements = [],
    text = '',
    label = '',
    autoFocus = false,
    showTime = false,
    isDisabled = false
}: GridFormElementProps<T>) {

    function isRecordOfBooleans(value: unknown): value is Record<string, boolean> {
        return (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Object.values(value).every((v) => typeof v === 'boolean')
        );
    }

    const componentToRender = () => {
        switch (type) {
            case 'radiogroup':
                return (
                    <Grid size={size}>
                        <FormControl
                            sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}
                            component='fieldset'
                            disabled={isDisabled}>
                            {text ? (
                                <Typography sx={{ color: '#6c6c6c' }} alignContent='center'>
                                    {text}
                                </Typography>
                            ) : (
                                ''
                            )}
                            <RadioGroup row value={formData[formKey]} onChange={handleInputChange<T, typeof formKey>(formKey, setFormData)}>
                                {elements.map((element) => (
                                    <FormControlLabel key={element} value={element} control={<Radio />} label={element} />
                                ))}
                            </RadioGroup>
                        </FormControl>
                    </Grid>
                );
            case 'select':
                return (
                    <Grid size={size}>
                        <FormControl size='small' fullWidth>
                            <Autocomplete
                                disabled={isDisabled}
                                freeSolo // <-- allows free text typing
                                options={elements} // your list of available options
                                value={typeof formData[formKey] === 'string' ? formData[formKey] : ''}
                                onChange={(_, newValue) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        [formKey]: newValue || ''
                                    }));
                                }}
                                onInputChange={(_, newInputValue) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        [formKey]: newInputValue || ''
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField {...params} label={label} size='small' sx={{ borderRadius: '5px', width: '100%' }} />
                                )}
                            />
                        </FormControl>
                    </Grid>
                );
            case 'textfield':
                return (
                    <Grid size={size}>
                        <TextField
                            disabled={isDisabled}
                            sx={{ borderRadius: '5px' }}
                            size='small'
                            type='text'
                            label={label}
                            variant='outlined'
                            value={formData[formKey]}
                            onChange={handleInputChange<T, typeof formKey>(formKey, setFormData)}
                            fullWidth
                            autoFocus={autoFocus}
                        />
                    </Grid>
                );
            case 'datepicker':
                const value = formData[formKey];
                return (
                    <Grid size={size}>
                        {showTime ? (
                            <BusinessDateTimePicker
                                disabled={isDisabled}
                                label={label}
                                value={value ? (value instanceof Date ? value : new Date(value as string)) : null}
                                onChange={(newValue) => {
                                    setFormData((prevData) => ({
                                        ...prevData,
                                        [formKey]: newValue || ''
                                    }));
                                }}
                                slotProps={{
                                    textField: { size: 'small', sx: { borderRadius: '5px', width: '100%' } }
                                }}
                            />
                        ) : (
                            <BusinessDatePicker
                                disabled={isDisabled}
                                label={label}
                                value={value ? (value instanceof Date ? value : new Date(value as string)) : null}
                                onChange={(newValue) => {
                                    setFormData((prevData) => ({
                                        ...prevData,
                                        [formKey]: newValue || ''
                                    }));
                                }}
                                slotProps={{
                                    textField: { size: 'small', sx: { borderRadius: '5px', width: '100%' } }
                                }}
                            />
                        )}
                    </Grid>
                );
            case 'checkbox':
                if (isRecordOfBooleans(formData[formKey])) {
                    const nestedCheckboxes = formData[formKey] as { [key: string]: boolean };
                    return (
                        <Grid size={size}>
                            <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{label ?? (text as string)}</Typography>
                            <FormGroup sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: { xs: 0, xl: 1 } }}>
                                {elements.map((element) => (
                                    <FormControlLabel
                                        key={element}
                                        control={
                                            <Checkbox
                                                disabled={isDisabled}
                                                checked={nestedCheckboxes[element] || false}
                                                onChange={(e) =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        [formKey]: {
                                                            ...(prev[formKey] as T[keyof T] as object),
                                                            [element]: e.target.checked
                                                        } as T[keyof T]
                                                    }))
                                                }
                                            />
                                        }
                                        label={element}
                                        sx={{
                                            userSelect: 'none',
                                            '& .MuiFormControlLabel-label': {
                                                fontSize: { xs: '0.875rem', xl: '1rem' } // label text responsive
                                            }
                                        }}
                                    />
                                ))}
                            </FormGroup>
                        </Grid>
                    );
                } else {
                    return (
                        <Grid size={size}>
                            <FormGroup>
                                <FormControlLabel
                                    key={formKey as string}
                                    control={
                                        <Checkbox
                                            disabled={isDisabled}
                                            checked={(formData[formKey] as boolean) || false}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    [formKey]: e.target.checked
                                                }))
                                            }
                                        />
                                    }
                                    label={label ?? (text as string)}
                                    sx={{ userSelect: 'none' }}
                                />
                            </FormGroup>
                        </Grid>
                    );
                }
            default:
                return null;
        }
    };

    return componentToRender();
}

export default GridFormElement;
