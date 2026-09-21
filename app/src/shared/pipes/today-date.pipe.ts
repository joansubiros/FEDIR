import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'todayDate', standalone: false })
export class TodayDatePipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined, locale = 'es-ES'): string {
    const d = value ? new Date(value as string) : new Date();
    if (isNaN(d.getTime())) return '';
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${weekday}, ${dd}-${mm}-${yyyy}`;
  }
}
