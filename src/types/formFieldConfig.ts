export type FormFieldConfigModel<T> = {
    type: string;
    size: number | { [key: string]: number };
    formKey: keyof T;
    label?: string;
    elements?: string[] |number[];
    text?: string;
    filesMax?: number;
    showTime?: boolean;
    autoFocus?: boolean;
    disabled?: boolean;
};
