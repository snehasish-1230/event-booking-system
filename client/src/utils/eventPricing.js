export const isPaidEvent = (event) =>
  event?.pricingType === 'PAID' || Number(event?.price) > 0;
