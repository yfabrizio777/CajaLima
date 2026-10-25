export const collectionMethods = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TRANSFER: 'Transferencia',
} as const
export const payments = { ...collectionMethods, CREDIT: 'Fiado' } as const
export type CollectionMethod = keyof typeof collectionMethods
export type PaymentMethod = keyof typeof payments
