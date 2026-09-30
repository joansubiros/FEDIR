import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { FileMakerService } from './filemaker.service';

export interface PersonalItem {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class PersonalService {
  private fm = inject(FileMakerService);

  private map$?: Observable<Map<string, string>>;
  private drivers$?: Observable<PersonalItem[]>;

  /** Todos los operarios de PERSONAL, indexados por UUID, serial y usuario. */
  getPersonalMap(): Observable<Map<string, string>> {
    if (!this.map$) {
      this.map$ = this.fm
        .listODataRecords<Record<string, unknown>>(
          'PERSONAL',
          ['Id_Personal', 'Id_Personal_serial', 'Nom_Complert', 'Cognoms', 'Usuari_Nom'],
          { filter: 'Flag_Actiu eq 1' },
        )
        .pipe(
          map(records => {
            const map = new Map<string, string>();
            for (const record of records) {
              const id = this.str(record['Id_Personal']);
              const serial = record['Id_Personal_serial'];
              const usuari = this.str(record['Usuari_Nom']);
              const nom = this.str(record['Nom_Complert']);
              const cognoms = this.str(record['Cognoms']);
              const fullName = nom || cognoms || usuari;
              if (!fullName) continue;
              if (id) {
                map.set(id, fullName);
                map.set(id.toLowerCase(), fullName);
              }
              if (serial != null && String(serial).trim() !== '') {
                map.set(String(serial).trim(), fullName);
              }
              if (usuari) {
                map.set(usuari.toLowerCase(), fullName);
              }
            }
            return map;
          }),
          catchError(err => {
            console.error('Error cargando PERSONAL:', err);
            return of(new Map<string, string>());
          }),
          shareReplay(1),
        );
    }
    return this.map$;
  }

  /** Operarios activos con Flag_Xofer = 1, para los desplegables de conductor. */
  getDrivers(): Observable<PersonalItem[]> {
    if (!this.drivers$) {
      this.drivers$ = this.fm
        .listODataRecords<Record<string, unknown>>(
          'PERSONAL',
          ['Id_Personal', 'Nom_Complert', 'Cognoms', 'Usuari_Nom'],
          { filter: 'Flag_Actiu eq 1 and Flag_Xofer eq 1', orderBy: 'Nom_Complert asc' },
        )
        .pipe(
          map(records =>
            records
              .map(record => ({
                id: this.str(record['Id_Personal']),
                name: this.str(record['Nom_Complert']) || this.str(record['Cognoms']) || this.str(record['Usuari_Nom']),
              }))
              .filter(person => person.id && person.name)
          ),
          catchError(err => {
            console.error('Error cargando conductores de PERSONAL:', err);
            return of([] as PersonalItem[]);
          }),
          shareReplay(1),
        );
    }
    return this.drivers$;
  }

  /** Resuelve un valor (UUID, serial o usuario) al nombre real de la tabla. */
  resolveName(value: unknown): Observable<string> {
    const key = this.str(value);
    if (!key) return of('');
    return this.getPersonalMap().pipe(
      map(map => map.get(key) ?? map.get(key.toLowerCase()) ?? ''),
    );
  }

  resolveNames(values: unknown[]): Observable<string[]> {
    if (!values.length) return of([]);
    return this.getPersonalMap().pipe(
      map(map => values.map(value => {
        const key = this.str(value);
        return key ? (map.get(key) ?? map.get(key.toLowerCase()) ?? '') : '';
      })),
    );
  }

  private str(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }
}
