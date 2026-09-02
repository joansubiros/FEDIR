import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'todayDate', standalone: false })
export class TodayDatePipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined, locale = 'es-ES'): string {
    const d = value ? new Date(value as string) : new Date();
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d);
  }
}
