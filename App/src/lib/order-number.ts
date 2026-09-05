/** One display identifier across POS, kitchen, order lists and receipts. */
export function orderNumber(id: string): string {
  return id.slice(-8).toUpperCase();
}
