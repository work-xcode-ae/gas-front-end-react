/** Arabic amount in words for vouchers: «فقط ألف ومائتان وخمسون درهماً و50 فلساً لا غير». */
const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ONES[o]} و${TENS[t]}` : TENS[t]); }
  }
  return parts.join(' و');
}

function scale(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${below1000(n)} ${few}`;
  return `${below1000(n)} ${many}`;
}

export function arabicNumberWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'صفر';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000), thousands = Math.floor((n % 1_000_000) / 1000), rest = n % 1000;
  if (millions) parts.push(scale(millions, 'مليون', 'مليونان', 'ملايين', 'مليون'));
  if (thousands) parts.push(scale(thousands, 'ألف', 'ألفان', 'آلاف', 'ألف'));
  if (rest) parts.push(below1000(rest));
  return parts.join(' و');
}

export function amountInWords(amount: number): string {
  const dirhams = Math.floor(Math.abs(amount));
  const fils = Math.round((Math.abs(amount) - dirhams) * 100);
  let s = `فقط ${arabicNumberWords(dirhams)} درهم إماراتي`;
  if (fils) s += ` و${arabicNumberWords(fils)} فلس`;
  return `${s} لا غير`;
}
