import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export function phoneValidator(
  phoneNumber: string,
  countryCode: CountryCode = 'ES'
): boolean {
  try {
    const phone = parsePhoneNumberFromString(phoneNumber, countryCode);
    return !!phone?.isValid();
  } catch {
    return false;
  }
}