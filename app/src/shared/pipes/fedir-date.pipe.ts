import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fedirDate', standalone: false })
export class FedirDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const s = String(value).trim();
    if (!s) return '—';

    // Handle different date formats
    let year = 0, month = 0, day = 0;

    if (s.includes('/')) {
      const parts = s.split('/').map(Number);
      if (parts.length === 3) {
        // FileMaker typically returns mm/dd/yyyy format
        // Check if the first part > 12 -> likely dd/mm/yyyy
        // Otherwise assume mm/dd/yyyy
        if (parts[0] > 12) {
          // Format is dd/mm/yyyy
          day = parts[0];
          month = parts[1];
          year = parts[2];
        } else {
          // Format is mm/dd/yyyy (FileMaker standard)
          month = parts[0];
          day = parts[1];
          year = parts[2];
        }
      }
    } else if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // Format is yyyy-mm-dd (HTML date input format)
          year = Number(parts[0]);
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          // Format is dd-mm-yyyy
          day = Number(parts[0]);
          month = Number(parts[1]);
          year = Number(parts[2]);
        }
      }
    }

    // Handle 2-digit years
    if (year > 0 && year < 100) {
      year += 2000;
    }

    // Validate and format
    if (year && month && day) {
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `${dd}-${mm}-${year}`;
    }

    return s;
  }
}
