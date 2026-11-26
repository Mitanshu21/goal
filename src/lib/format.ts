export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** Short rupee amounts: ₹4L, ₹1.4L, ₹2.5Cr, ₹25,000 */
export function lakh(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return '₹' + (n / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
  if (a >= 1e5) return '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
  return inr(n);
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
