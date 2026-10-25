export const payments = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
} as const
export type PaymentMethod = keyof typeof payments
