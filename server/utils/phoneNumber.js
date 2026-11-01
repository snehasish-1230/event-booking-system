const PHONE_NUMBER_PATTERN = /^\+?[0-9][0-9\s().-]*$/;

const isValidPhoneNumber = (value) => {
  if (typeof value !== 'string') return false;

  const phone = value.trim();
  if (!PHONE_NUMBER_PATTERN.test(phone)) return false;

  const hasInternationalPrefix = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (hasInternationalPrefix) {
    if (digits.startsWith('91')) {
      return /^91[6-9]\d{9}$/.test(digits);
    }
    return /^[1-9]\d{6,14}$/.test(digits);
  }

  if (/^\d{10}$/.test(digits)) {
    return /^[6-9]\d{9}$/.test(digits);
  }
  if (/^91\d{10}$/.test(digits)) {
    return /^91[6-9]\d{9}$/.test(digits);
  }
  return /^[1-9]\d{6,14}$/.test(digits);
};

module.exports = isValidPhoneNumber;
