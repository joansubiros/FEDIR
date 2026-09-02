import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fedirDate', standalone: false })
export class FedirDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const s = String(value).trim();
    if (!s) return '—';
    let y = 0, m = 0, d = 0;
    if (s.includes('/')) {
      const p = s.split('/');
      if (p.length !== 3) return s;
      const a = Number(p[0]), b = Number(p[1]), c = Number(p[2]);
      if (c > 31) { m = a; d = b; y = c; } else if (a > 31) { y = a; m = b; d = c; } else { m = Number(p[0]); d = Number(p[1]); y = Number(p[2]); if (y < 100) y += 2000; }
    } else if (s.includes('-')) {
      const p = s.split('-');
      if (p.length === 3) {
        if (p[0].length === 4) { y = Number(p[0]); m = Number(p[1]); d = Number(p[2]); }
        else { d = Number(p[0]); m = Number(p[1]); y = Number(p[2]); if (y < 100) y += 2000; }
      } else return s;
    } else return s;
    if (!y || !m || !d) return s;
    const dd = String(d).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${dd}-${mm}-${y}`;
  }
}
