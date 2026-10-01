import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, concatMap, expand, forkJoin, map, of, reduce, shareReplay, switchMap, throwError } from 'rxjs';
import { FileMakerService } from '../../core/services/filemaker.service';
import { SessionService } from '../../core/services/session.service';
import { PersonalService, type PersonalItem } from './personal.service';
import type { RutaListItem, RutaDetalle, LrutaDetalle, DireccioItem, FmRecord, FmFindResponse } from '../../core/models/fm.models';

const getFieldStr = (data: Record<string, unknown>, names: string[]): string => {
  for (const n of names) {
    if (data[n] !== undefined && data[n] !== null && String(data[n]).trim() !== '') {
      return String(data[n]).trim();
    }
  }
  for (const n of names) {
    const suffix = n.split('::').pop()!.toLowerCase();
    for (const k of Object.keys(data)) {
      if (k.toLowerCase().endsWith(suffix) && data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== '') {
        return String(data[k]).trim();
      }
    }
  }
  return '';
};

@Injectable({ providedIn: 'root' })
export class RutaService {
  private fm = inject(FileMakerService);
  private personal = inject(PersonalService);


  list(limit = 50, offset = 0): Observable<{ items: RutaListItem[]; total: number }> {
    // Orden descendente por fecha: las rutas más recientes aparecen primero.
    const sort = [{ fieldName: 'Data', sortOrder: 'descend' }];
    return this.fm.listRecords('Phone_Ruta_List', { limit, offset, sort }).pipe(
      map(res => ({
        total: res.response.dataInfo.totalRecordCount,
        items: res.response.data.map(r => ({
          recordId: r.recordId,
          modId: r.modId,
          idRutaSerial: Number(r.fieldData['Id_Ruta_serial'] ?? 0),
          data: String(r.fieldData['Data'] ?? ''),
          matricula: String((r.fieldData['ruta_VEHICLES::Matricula'] as string) ?? ''),
          countPunts: Number(r.fieldData['Count_Punts'] ?? 0),
          countPuntsPendents: Number(r.fieldData['Count_Punts_Pendents'] ?? 0),
        })),
      })),
    );
  }

  /** Devuelve el recordId del último registro (última ruta creada). */
  getDetalle(recordId: string, idRutaSerial?: number): Observable<RutaDetalle> {
    return this.fm.getRecord('Phone_Ruta', recordId).pipe(
      catchError(err => {
        if (idRutaSerial == null) return throwError(() => err);
        return this.fm.findRecords('Phone_Ruta', [{ Id_Ruta_serial: String(idRutaSerial) }], { limit: 1 });
      }),
      switchMap(res => {
        if (res.response.data?.length || idRutaSerial == null) return of(res);
        return this.fm.findRecords('Phone_Ruta', [{ Id_Ruta_serial: String(idRutaSerial) }], { limit: 1 });
      }),
      switchMap(res => {
        if (!res.response.data?.length) throw new Error(`No se encontró la ruta ${idRutaSerial ?? recordId}`);
        const r = res.response.data[0];
        const p1 = (r.portalData?.['portal_1'] ?? []) as unknown as Record<string, unknown>[];
        const portalParadas = p1.map(x => ({
          recordId: String(x['recordId'] ?? ''),
          modId: String(x['modId'] ?? ''),
          idLRuta: String(x['Id_LRuta'] ?? ''),
          idLRutaSerial: Number(x['Id_LRuta_serial'] ?? x['ruta_LRUTES::Id_LRuta_serial'] ?? 0),
          idRuta: String(x['Id_Ruta'] ?? r.fieldData['Id_Ruta'] ?? ''),
          idLDireccio: String(x['Id_LDireccio'] ?? ''),
          idClient: String(x['Id_Client'] ?? ''),
          idClientPrint: String(x['ruta_lruta_CLIENTS::Id_Client_Print'] ?? ''),
          nomEmpresa: String(x['ruta_lruta_CLIENTS::Nom_Empresa'] ?? ''),
          direccio: String(x['ruta_lruta_LDIRECCIONS::Direccio'] ?? ''),
          nomDireccio: String(x['ruta_lruta_LDIRECCIONS::Nom_Direccio'] ?? ''),
          etiquetaDireccio: String(x['ruta_lruta_LDIRECCIONS::Etiqueta_Direccio'] ?? ''),
          tel1: String(x['ruta_lruta_ldir_LCONTACTES::Tel_1'] ?? ''),
          hDesde: String(x['ruta_lruta_LDIRECCIONS::H_Desde'] ?? ''),
          hFins: String(x['ruta_lruta_LDIRECCIONS::H_Fins'] ?? ''),
          latitud: this.numberOrNull(x['ruta_lruta_LDIRECCIONS::Latitud']),
          longitud: this.numberOrNull(x['ruta_lruta_LDIRECCIONS::Longitud']),
          flagFet: String(x['Flag_Fet'] ?? ''),
          flagAnulat: String(x['Flag_Anulat'] ?? ''),
        }));
        return forkJoin(portalParadas.map(point => this.fm.getRecord('Phone_LRuta', point.recordId).pipe(
          map(pointResponse => {
            const fields = pointResponse.response.data[0]?.fieldData ?? {};
            const text = (names: string[], fallback: string): string => {
              for (const name of names) {
                const value = String(fields[name] ?? '').trim();
                if (value) return value;
              }
              return fallback;
            };
            return {
              ...point,
              idClient: text(['Id_Client', 'lruta_CLIENTS::Id_Client'], point.idClient),
              idClientPrint: text(['lruta_CLIENTS::Id_Client_Print', 'ruta_lruta_CLIENTS::Id_Client_Print'], point.idClientPrint),
              nomEmpresa: text(['lruta_CLIENTS::Nom_Empresa', 'ruta_lruta_CLIENTS::Nom_Empresa'], point.nomEmpresa),
              direccio: text(['lruta_LDIRECCIONS::Direccio', 'ruta_lruta_LDIRECCIONS::Direccio'], point.direccio),
              flagFet: String(fields['Flag_Fet'] ?? point.flagFet),
              flagAnulat: String(fields['Flag_Anulat'] ?? point.flagAnulat),
            };
          }),
          catchError(() => of(point)),
        ))).pipe(
          switchMap(statusPoints => forkJoin(statusPoints.map(point => {
            if (!point.idClient && !point.idClientPrint && !point.nomEmpresa) return of(point);
            const query = point.idClient
              ? [{ Id_Client: point.idClient }]
              : point.idClientPrint
                ? [{ Id_Client_Print: point.idClientPrint }]
                : [{ Nom_Empresa: point.nomEmpresa }];
            return this.fm.findRecords('Clients_Llista', query, { limit: 1 }).pipe(
              map(clientResponse => {
                const fields = clientResponse.response.data[0]?.fieldData ?? {};
                const value = (names: string[]): string => names.map(name => String(fields[name] ?? '').trim()).find(Boolean) ?? '';
                const address = [
                  value(['Direccio', 'CLIENTS::Direccio']),
                  value(['CP', 'CLIENTS::CP']),
                  value(['Poblacio', 'CLIENTS::Poblacio']),
                ].filter(Boolean).join(', ');
                return { ...point, direccio: address || point.direccio };
              }),
              catchError(() => of(point)),
            );
          }))),
          map(statusPoints => {
            const fd = r.fieldData as Record<string, unknown>;
            const rawMatricula = getFieldStr(fd, ['ruta_VEHICLES::Matricula', 'VEHICLES::Matricula', 'Matricula']);
            const rawPersonal1 = getFieldStr(fd, ['ruta_PERSONAL1::Nom_Compllet', 'ruta_PERSONAL1::Nom', 'Nom_Personal_1', 'Id_Personal_1', 'RUTA::Id_Personal_1']);
            const rawPersonal2 = getFieldStr(fd, ['ruta_PERSONAL2::Nom_Compllet', 'ruta_PERSONAL2::Nom', 'Nom_Personal_2', 'Id_Personal_2', 'RUTA::Id_Personal_2']);
            const rawPersonal3 = getFieldStr(fd, ['ruta_PERSONAL3::Nom_Compllet', 'ruta_PERSONAL3::Nom', 'Nom_Personal_3', 'Id_Personal_3', 'RUTA::Id_Personal_3']);
            const rawData = getFieldStr(fd, ['Data', 'RUTA::Data']);

            return {
              recordId: r.recordId,
              modId: r.modId,
              fieldData: {
                Id_Ruta: String(fd['Id_Ruta'] ?? ''),
                Id_Ruta_serial: Number(fd['Id_Ruta_serial'] ?? fd['RUTA::Id_Ruta_serial'] ?? fd['ruta_RUTA::Id_Ruta_serial'] ?? 0),
                Nom_Personal_1: rawPersonal1,
                Nom_Personal_2: rawPersonal2,
                Nom_Personal_3: rawPersonal3,
                Id_Personal_1: String(fd['Id_Personal_1'] ?? fd['RUTA::Id_Personal_1'] ?? ''),
                Id_Personal_2: String(fd['Id_Personal_2'] ?? fd['RUTA::Id_Personal_2'] ?? ''),
                Id_Personal_3: String(fd['Id_Personal_3'] ?? fd['RUTA::Id_Personal_3'] ?? ''),
                Id_Vehicle: String(fd['Id_Vehicle'] ?? fd['RUTA::Id_Vehicle'] ?? ''),
                Matricula_Vehicle: rawMatricula || String(fd['Id_Vehicle'] ?? ''),
                Marca_Model_Vehicle: '',
                Data: rawData,
                Temps_Privisio: Number(fd['Temps_Privisio'] ?? fd['RUTA::Temps_Privisio'] ?? fd['ruta_RUTA::Temps_Privisio'] ?? 0),
                Temps_Privisio_txt: String(fd['Temps_Privisio_txt'] ?? fd['RUTA::Temps_Privisio_txt'] ?? fd['ruta_RUTA::Temps_Privisio_txt'] ?? ''),
                Km_Privisio: Number(fd['Km_Privisio'] ?? fd['RUTA::Km_Privisio'] ?? fd['ruta_RUTA::Km_Privisio'] ?? 0),
                Estat: String(fd['Estat'] ?? fd['RUTA::Estat'] ?? fd['ruta_RUTA::Estat'] ?? ''),
              },
              portalParadas: statusPoints,
              portalClientes: Array.from(new Map(
                statusPoints
                  .filter(point => point.idClient || point.idClientPrint || point.nomEmpresa)
                  .map(point => [point.idClient || point.idClientPrint || point.nomEmpresa, {
                    recordId: point.recordId,
                    idClientPrint: point.idClientPrint,
                    nomEmpresa: point.nomEmpresa,
                  }]),
              ).values()),
            };
          }),
          switchMap(base => {
            // Si la matrícula o algún nombre no se pudieron resolver inmediatamente,
            // consultamos los layouts auxiliares de Personal y Vehicles
            const fd = r.fieldData as Record<string, unknown>;
            const idVehicle = String(fd['Id_Vehicle'] ?? fd['RUTA::Id_Vehicle'] ?? '');
            const needVehicle = !base.fieldData.Matricula_Vehicle || base.fieldData.Matricula_Vehicle.length > 20;
            const vehicle$ = (needVehicle && idVehicle)
              ? this.fm.findRecords('Vehicles_Llista', [{ Id_Vehicle: idVehicle }], { limit: 1 }).pipe(
                  map(vres => {
                    const vf = vres.response.data?.[0]?.fieldData ?? {};
                    return getFieldStr(vf, ['Matricula', 'VEHICLES::Matricula']);
                  }),
                  catchError(() => of('')),
                )
              : of(base.fieldData.Matricula_Vehicle);

            // Los nombres de personal siempre se resuelven contra la tabla PERSONAL.
            const personalKeys = [
              base.fieldData.Nom_Personal_1,
              base.fieldData.Nom_Personal_2,
              base.fieldData.Nom_Personal_3,
            ];
            const personal$ = this.personal.resolveNames(personalKeys).pipe(
              map(names => {
                const slots = ['Nom_Personal_1', 'Nom_Personal_2', 'Nom_Personal_3'] as const;
                personalKeys.forEach((key, i) => {
                  base.fieldData[slots[i]] = names[i] || key;
                });
              }),
            );

            const needEstat = !base.fieldData.Estat;
            const filter = base.fieldData.Id_Ruta
              ? `Id_Ruta eq '${base.fieldData.Id_Ruta}'`
              : base.fieldData.Id_Ruta_serial
                ? `Id_Ruta_serial eq ${base.fieldData.Id_Ruta_serial}`
                : '';
            const estat$ = (needEstat && filter)
              ? this.fm.listODataRecords<Record<string, unknown>>('RUTA', ['Estat'], { filter }).pipe(
                  map(records => String(records[0]?.['Estat'] ?? '').trim()),
                  catchError(() => of('')),
                )
              : of(base.fieldData.Estat);

            return forkJoin({ matricula: vehicle$, estat: estat$, personal: personal$ }).pipe(
              map(({ matricula, estat }) => {
                if (matricula) base.fieldData.Matricula_Vehicle = matricula;
                if (estat) {
                  base.fieldData.Estat = estat;
                } else if (!base.fieldData.Estat) {
                  const total = base.portalParadas.length;
                  const done = base.portalParadas.filter(p => p.flagFet === '1' || p.flagAnulat === '1').length;
                  const pending = total - done;
                  if (total === 0) {
                    base.fieldData.Estat = 'Pendiente';
                  } else if (pending === 0) {
                    base.fieldData.Estat = 'Realizado';
                  } else if (done > 0) {
                    base.fieldData.Estat = 'Parcial';
                  } else {
                    base.fieldData.Estat = 'Iniciado';
                  }
                }
                return base;
              }),
            );
          }),
        );
      }),
    );
  }

  create(data: { Data: string; Id_Vehicle: string; Id_Personal_1?: string; Id_Personal_2?: string; Id_Personal_3?: string }): Observable<{ recordId: string }> {
    return this.fm.createRecord('Phone_Ruta_New', data as Record<string, unknown>).pipe(
      map(r => ({ recordId: r.response.recordId })),
    );
  }

  private numberOrNull(value: unknown): number | null {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
}

@Injectable({ providedIn: 'root' })
export class LrutaService {
  private fm = inject(FileMakerService);


  get(recordId: string): Observable<LrutaDetalle> {
    return this.fm.getRecord('Phone_LRuta', recordId).pipe(
      map(res => {
        const r = res.response.data[0];
        const fd = r.fieldData as Record<string, unknown>;
        const field = (names: string[]): unknown => {
          for (const name of names) {
            if (fd[name] !== undefined && fd[name] !== null && fd[name] !== '') return fd[name];
          }
          const suffixes = names.map(name => name.toLowerCase().split('::').pop()!);
          const match = Object.entries(fd).find(([key, value]) => {
            if (value === undefined || value === null || value === '') return false;
            const normalizedKey = key.toLowerCase().split('::').pop()!;
            return suffixes.includes(normalizedKey);
          });
          if (match) return match[1];
          return '';
        };
        const numberField = (names: string[]): number | null => {
          const value = field(names);
          if (value === '') return null;
          const number = Number(value);
          return Number.isFinite(number) ? number : null;
        };
        return {
          recordId: r.recordId,
          modId: r.modId,
          idRutaSerial: numberField([
            'ldir_lruta_RUTA::Id_Ruta_serial',
            'lruta_RUTA::Id_Ruta_serial',
            'ruta_LRUTA::Id_Ruta_serial',
            'RUTA::Id_Ruta_serial',
            'Id_Ruta_serial',
          ]) ?? 0,
          quantContEntregats: numberField(['Quant_Cont_Entregats', 'lruta_LRUTES::Quant_Cont_Entregats']),
          quantContRecollits: numberField(['Quant_Cont_Recollits', 'lruta_LRUTES::Quant_Cont_Recollits']),
          quantKg: numberField(['Quant_Kg', 'lruta_LRUTES::Quant_Kg']),
          quantL: numberField(['Quant_L', 'lruta_LRUTES::Quant_L']),
          preuUd: Number(fd['lruta_LDIRECCIONS::Preu_ud'] ?? 0),
          total: Number(field(['Total', 'lruta_LRUTES::Total']) || 0),
          tipUsUd: String(fd['lruta_LDIRECCIONS::Tipus_ud'] ?? ''),
          tipUsContenidor: String(fd['lruta_LDIRECCIONS::Tipus_Contenidor'] ?? ''),
          quantContenidor: Number(field(['lruta_LDIRECCIONS::Quant_Contenidor']) || 0),
          flagFet: String(field(['Flag_Fet', 'lruta_LRUTES::Flag_Fet'])),
          flagAnulat: String(field(['Flag_Anulat', 'lruta_LRUTES::Flag_Anulat'])),
          motiuAnulat: String(field(['Motiu_Anulat', 'lruta_LRUTES::Motiu_Anulat'])),
          observacions: String(field(['Observacions', 'lruta_LRUTES::Observacions'])),
          etiquetaDireccio: String(fd['lruta_LDIRECCIONS::Etiqueta_Direccio'] ?? ''),
          nomDireccio: String(fd['lruta_LDIRECCIONS::Nom_Direccio'] ?? ''),
          direccio: String(fd['lruta_LDIRECCIONS::Direccio'] ?? ''),
          frequencia: Number(fd['lruta_LDIRECCIONS::Frequencia'] ?? 0),
          tel1: String(fd['lruta_ldir_LCONTACTES::Tel_1'] ?? ''),
          nom: String(fd['lruta_ldir_LCONTACTES::Nom'] ?? ''),
        };
      }),
    );
  }

  update(recordId: string, fieldData: Record<string, unknown>, modId?: string): Observable<unknown> {
    return this.fm.updateRecord('Phone_LRuta', recordId, fieldData, { modId });
  }

  addPoint(idRuta: string, idLDireccio: string): Observable<{ recordId: string }> {
    return this.fm.createRecord('Phone_LRuta', { Id_Ruta: idRuta, Id_LDireccio: idLDireccio }).pipe(
      map(r => ({ recordId: r.response.recordId })),
    );
  }

  updateOrder(recordId: string, serial: number, modId?: string): Observable<unknown> {
    return this.fm.updateRecord('Phone_LRuta', recordId, { Id_LRuta_serial: serial }, { modId });
  }

  swapOrder(first: { recordId: string; serial: number; modId: string }, second: { recordId: string; serial: number; modId: string }): Observable<unknown> {
    const temporarySerial = Math.max(first.serial, second.serial) + 1;
    return this.updateOrder(first.recordId, temporarySerial).pipe(
      concatMap(() => this.updateOrder(second.recordId, first.serial)),
      concatMap(() => this.updateOrder(first.recordId, second.serial)),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class DireccioService {
  private fm = inject(FileMakerService);
  private personal = inject(PersonalService);
  private session = inject(SessionService);

  private readonly allAccessUsers = ['fbellota', 'grodriguez', 'jsubiros'];

  // IDs conocidos de PERSONAL (tabla PERSONAL) como respaldo inmediato
  private readonly fallbackPersonalIds: Record<string, string> = {
    fbellota: 'C5FB60B7-25CE-9040-9789-92F7CA3733ED',
    grodriguez: '35BD3E35-2FAE-E94F-AD97-5008AF6F099B',
    mbarbitta: '80C8DDA9-BD67-9745-AD7E-504FED2C9902',
    mbarbita: '80C8DDA9-BD67-9745-AD7E-504FED2C9902',
    scoronel: 'C8492DB0-FD3A-EA40-BB5E-2DA3548A1B97',
    bdimauro: '6C0A90C8-F694-274E-8625-754C40B70B5B',
    tgarmendia: 'B4B70BA2-89DA-C942-9E88-414AAEA922F0',
  };

  getPersonalMap(): Observable<Map<string, string>> {
    return this.personal.getPersonalMap();
  }

  getDriversList(): Observable<PersonalItem[]> {
    return this.personal.getDrivers();
  }

  getCurrentUsername(): string | null {
    const creds = this.session.getCredentials();
    if (!creds?.username) return null;
    return creds.username.toLowerCase().trim();
  }

  isAllAccessUser(username?: string | null): boolean {
    const u = (username ?? this.getCurrentUsername())?.toLowerCase().trim();
    return u != null && this.allAccessUsers.includes(u);
  }

  getUserAccessInfo(): Observable<{ isAllAccess: boolean; idPersonal: string | null }> {
    const username = this.getCurrentUsername();
    if (!username) {
      return of({ isAllAccess: false, idPersonal: null });
    }

    if (this.allAccessUsers.includes(username)) {
      return of({ isAllAccess: true, idPersonal: null });
    }

    // Para el resto de usuarios: buscar su Id_Personal en PERSONAL vía OData
    return this.fm.listODataRecords<Record<string, unknown>>(
      'PERSONAL',
      ['Id_Personal', 'Usuari_Nom'],
      { filter: `Usuari_Nom eq '${username}'` }
    ).pipe(
      map(records => {
        const record = records.find(r => String(r['Usuari_Nom']).toLowerCase().trim() === username);
        const id = record ? String(record['Id_Personal'] || '').trim() : '';
        return id || this.fallbackPersonalIds[username] || null;
      }),
      catchError(err => {
        console.warn(`[direcciones] Error consultando OData PERSONAL para ${username}:`, err);
        return of(this.fallbackPersonalIds[username] || null);
      }),
      map(idPersonal => ({ isAllAccess: false, idPersonal }))
    );
  }

  /** Índice local (todas las direcciones del usuario con sus datos de dirección), cacheado por usuario. */
  private index$?: Observable<DireccioItem[]>;
  private indexUser = '';

  private getIndex(): Observable<DireccioItem[]> {
    const user = this.getCurrentUsername() ?? '';
    if (!this.index$ || this.indexUser !== user) {
      this.indexUser = user;
      const index$ = this.buildIndex().pipe(
        catchError(err => {
          // No cachear fallos: el siguiente intento vuelve a construir el índice
          if (this.index$ === index$) this.index$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
      this.index$ = index$;
    }
    return this.index$;
  }

  /** Descarga paginada completa de un layout (find o list). */
  private fetchAll(page: (offset: number) => Observable<FmFindResponse>, pageSize = 500, maxRecords = 10000): Observable<FmRecord[]> {
    type State = { next: number; data: FmRecord[]; done: boolean };
    return of<State>({ next: 0, data: [], done: false }).pipe(
      expand(s => s.done
        ? EMPTY
        : page(s.next).pipe(
            map(res => {
              const data = res.response.data ?? [];
              const next = s.next + data.length;
              return { next, data, done: data.length < pageSize || next >= maxRecords } as State;
            }),
            // 401 "sin registros" (HTTP 404) => lista vacía
            catchError(err => {
              const code = err?.error?.messages?.[0]?.code;
              if (code === '401') return of<State>({ next: s.next, data: [], done: true });
              return throwError(() => err);
            }),
          )),
      reduce((acc, s) => acc.concat(s.data), [] as FmRecord[]),
    );
  }

  private mapRecord(r: FmRecord): DireccioItem {
    return {
      recordId: r.recordId,
      modId: r.modId,
      idDireccio: getFieldStr(r.fieldData, ['Id_Direccio_serial', 'Id_Direccio']),
      nomDireccio: getFieldStr(r.fieldData, ['Nom_Direccio']),
      direccio: getFieldStr(r.fieldData, ['Direccio']),
      poblacio: getFieldStr(r.fieldData, ['Poblacio']),
      barri: getFieldStr(r.fieldData, ['Barri']),
      provincia: getFieldStr(r.fieldData, ['Provincia']),
      empresa: getFieldStr(r.fieldData, ['ldir_PROVEIDORS::Empresa', 'Empresa']),
      listContactes: getFieldStr(r.fieldData, ['ldir_PROVEIDORS::List_Contactes', 'List_Contactes']),
      tel1: getFieldStr(r.fieldData, ['ldir_LCONTACTES::Tel_1', 'Tel_1']),
      etiquetaProv: getFieldStr(r.fieldData, ['ldir_PROVEIDORS::Etiqueta_Prov', 'Etiqueta_Prov']),
      etiquetaDireccio: getFieldStr(r.fieldData, ['Etiqueta_Direccio']),
      idXofer: getFieldStr(r.fieldData, ['Id_Xofer']),
      nomXofer: getFieldStr(r.fieldData, ['ldir_PERSONAL::Nom_Complert', 'Nom_Compllet']),
    };
  }

  private buildIndex(): Observable<DireccioItem[]> {
    return this.getUserAccessInfo().pipe(
      switchMap(access => {
        if (!access.isAllAccess && !access.idPersonal) {
          // Usuario no autorizado o sin Id_Personal -> lista vacía
          return of([] as DireccioItem[]);
        }

        if (!access.isAllAccess) {
          // Conductor normal: descargar solo las direcciones que le corresponden
          return this.fetchAll(offset =>
            this.fm.findRecords('Ldir_Llista', [{ Id_Xofer: access.idPersonal! }], { limit: 500, offset })
          ).pipe(
            switchMap(base => {
              const items = base
                .map(r => this.mapRecord(r))
                .filter(d => !d.idXofer || d.idXofer.toLowerCase() === access.idPersonal!.toLowerCase());
              return this.enrichWithAddressItems(items);
            })
          );
        }

        // Acceso total (fbellota, grodriguez, jsubiros): descargar todas
        const base$ = this.fetchAll(offset => this.fm.listRecords('Ldir_Llista', { limit: 500, offset }));
        const addr$ = this.fetchAll(offset => this.fm.listRecords('Phone_Ldir_Llista', { limit: 500, offset })).pipe(
          catchError(err => {
            console.warn('[direcciones] no se pudo cargar Phone_Ldir_Llista', err);
            return of([] as FmRecord[]);
          }),
        );

        return forkJoin([base$, addr$]).pipe(
          map(([base, addr]) => {
            const addrById = new Map<string, FmRecord>(addr.map(r => [r.recordId, r]));
            return base.map(r => {
              const item = this.mapRecord(r);
              const a = addrById.get(r.recordId);
              if (!a) return item;
              const ai = this.mapRecord(a);
              return {
                ...item,
                direccio: (ai.direccio && ai.direccio !== item.nomDireccio) ? ai.direccio : item.direccio,
                poblacio: ai.poblacio || item.poblacio,
                barri: ai.barri || item.barri,
                provincia: ai.provincia || item.provincia,
                empresa: ai.empresa || item.empresa,
                listContactes: ai.listContactes || item.listContactes,
                etiquetaProv: ai.etiquetaProv || item.etiquetaProv,
                etiquetaDireccio: ai.etiquetaDireccio || item.etiquetaDireccio,
              };
            });
          })
        );
      })
    );
  }

  private normalize(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Búsqueda local (sin acentos ni mayúsculas) por nombre, dirección, población, barrio y empresa; todas las palabras deben coincidir. */
  search(query: string, limit = 50, offset = 0): Observable<{ items: DireccioItem[]; total: number }> {
    const words = this.normalize(query).split(/\s+/).filter(Boolean);
    return this.getIndex().pipe(
      map(all => {
        const matches = words.length
          ? all.filter(d => {
              const hay = this.normalize([d.nomDireccio, d.direccio, d.poblacio, d.barri, d.provincia, d.empresa, d.etiquetaDireccio].join(' '));
              return words.every(w => hay.includes(w));
            })
          : all;
        return { total: matches.length, items: matches.slice(offset, offset + limit) };
      }),
    );
  }

  list(limit = 50, offset = 0): Observable<{ items: DireccioItem[]; total: number }> {
    return this.getUserAccessInfo().pipe(
      switchMap(access => {
        if (!access.isAllAccess && !access.idPersonal) {
          return of({ items: [], total: 0 });
        }

        if (!access.isAllAccess) {
          // Conductor normal: buscar sólo sus direcciones por Id_Xofer
          return this.fm.findRecords('Ldir_Llista', [{ Id_Xofer: access.idPersonal! }], { limit, offset }).pipe(
            catchError(err => {
              const code = err?.error?.messages?.[0]?.code;
              if (code === '401') {
                return of({
                  response: {
                    dataInfo: { totalRecordCount: 0, foundCount: 0, returnedCount: 0, database: '', layout: '', table: '' },
                    data: []
                  },
                  messages: []
                } as FmFindResponse);
              }
              return throwError(() => err);
            }),
            switchMap(res => {
              const items: DireccioItem[] = (res.response?.data ?? [])
                .map(r => this.mapRecord(r))
                .filter(d => !d.idXofer || d.idXofer.toLowerCase() === access.idPersonal!.toLowerCase());
              return this.enrichWithAddressItems(items).pipe(
                map(enrichedItems => ({ total: res.response?.dataInfo?.foundCount ?? 0, items: enrichedItems }))
              );
            })
          );
        }

        // Acceso total (fbellota, grodriguez, jsubiros): mostrar todos los registros
        return this.fm.listRecords('Ldir_Llista', { limit, offset }).pipe(
          switchMap(res => {
            const items: DireccioItem[] = (res.response?.data ?? []).map(r => this.mapRecord(r));
            return this.enrichWithAddressItems(items).pipe(
              map(enrichedItems => ({ total: res.response?.dataInfo?.totalRecordCount ?? 0, items: enrichedItems }))
            );
          })
        );
      })
    );
  }

  private enrichWithAddressItems(items: DireccioItem[]): Observable<DireccioItem[]> {
    if (!items.length) return of(items);
    const recordIds = items.map(i => i.recordId);
    return forkJoin(
        recordIds.map(id => this.fm.getRecord('Phone_Ldir_Llista', id).pipe(
          catchError(() => of(null))
        ))
    ).pipe(
      map(results => {
        const addressMap = new Map<string, {
          direccio: string; poblacio: string; barri: string; provincia: string; empresa: string;
          listContactes: string; etiquetaProv: string; etiquetaDireccio: string;
        }>();
        results.forEach((res, idx) => {
          const recordId = recordIds[idx];
          if (res?.response?.data?.[0]?.fieldData) {
            const fd = res.response.data[0].fieldData;
            addressMap.set(recordId, {
              direccio: getFieldStr(fd, ['Direccio']),
              poblacio: getFieldStr(fd, ['Poblacio']),
              barri: getFieldStr(fd, ['Barri']),
              provincia: getFieldStr(fd, ['Provincia']),
              empresa: getFieldStr(fd, ['Empresa']),
              listContactes: getFieldStr(fd, ['List_Contactes']),
              etiquetaProv: getFieldStr(fd, ['Etiqueta_Prov']),
              etiquetaDireccio: getFieldStr(fd, ['Etiqueta_Direccio']),
            });
          }
        });
        return items.map(item => {
          const addr = addressMap.get(item.recordId);
          return {
            ...item,
            direccio: (addr?.direccio && addr.direccio !== item.nomDireccio) ? addr.direccio : item.direccio,
            poblacio: addr?.poblacio || item.poblacio,
            barri: addr?.barri || item.barri,
            provincia: addr?.provincia || item.provincia,
            empresa: addr?.empresa || item.empresa,
            listContactes: addr?.listContactes || item.listContactes,
            etiquetaProv: addr?.etiquetaProv || item.etiquetaProv,
            etiquetaDireccio: addr?.etiquetaDireccio || item.etiquetaDireccio,
          };
        });
      })
    );
  }

  private resolveDriverNames(items: DireccioItem[]): Observable<DireccioItem[]> {
    if (!items.length) return of(items);
    return this.getPersonalMap().pipe(
      map(personalMap => items.map(item => {
        const name = personalMap.get(item.idXofer) ?? personalMap.get(item.idXofer.toLowerCase()) ?? '';
        return {
          ...item,
          nomXofer: name || item.idXofer,
        };
      }))
    );
  }

  updateXofer(recordId: string, idXofer: string, modId?: string): Observable<unknown> {
    return this.fm.updateRecord('Ldir_Llista', recordId, { Id_Xofer: idXofer }, { modId });
  }
}
