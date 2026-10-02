/** Número visible del pedido: "#" + últimos 6 dígitos del timestamp. */
export function generateOrderNumber(now: number = Date.now()): string {
  return `#${now.toString().slice(-6)}`;
}
