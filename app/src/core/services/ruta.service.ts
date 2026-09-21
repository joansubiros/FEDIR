import { Injectable } from '@angular/core';
import { Observable, catchError, concatMap, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { FileMakerService } from '../../core/services/filemaker.service';
import type { RutaListItem, RutaDetalle, LrutaDetalle, DireccioItem } from '../../core/models/fm.models';

@Injectable({ providedIn: 'root' })
export class RutaService {
  constructor(private fm: FileMakerService) {}

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
          map(statusPoints => ({
            recordId: r.recordId,
            modId: r.modId,
            fieldData: {
              Id_Ruta: String(r.fieldData['Id_Ruta'] ?? ''),
              Id_Ruta_serial: Number(r.fieldData['Id_Ruta_serial'] ?? r.fieldData['RUTA::Id_Ruta_serial'] ?? r.fieldData['ruta_RUTA::Id_Ruta_serial'] ?? 0),
              Nom_Personal_1: String(r.fieldData['ruta_PERSONAL1::Nom_Complert'] ?? ''),
              Nom_Personal_2: String(r.fieldData['ruta_PERSONAL2::Nom_Complert'] ?? ''),
              Nom_Personal_3: String(r.fieldData['ruta_PERSONAL3::Nom_Complert'] ?? ''),
              Id_Personal_1: String(r.fieldData['Id_Personal_1'] ?? ''),
              Id_Personal_2: String(r.fieldData['Id_Personal_2'] ?? ''),
              Id_Personal_3: String(r.fieldData['Id_Personal_3'] ?? ''),
              Id_Vehicle: String(r.fieldData['Id_Vehicle'] ?? ''),
              Data: String(r.fieldData['Data'] ?? ''),
              Temps_Privisio_txt: String(r.fieldData['Temps_Privisio_txt'] ?? ''),
              Km_Privisio: Number(r.fieldData['Km_Privisio'] ?? 0),
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
          })),
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
  constructor(private fm: FileMakerService) {}

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
  constructor(private fm: FileMakerService) {}

  search(query: string, limit = 50, offset = 0): Observable<{ items: DireccioItem[]; total: number }> {
    const q: Record<string, unknown>[] = query
      ? [
          { 'Nom_Direccio': `*${query}*` },
          { 'Direccio': `*${query}*` },
          { 'Poblacio': `*${query}*` },
          { 'Barri': `*${query}*` },
          { 'Provincia': `*${query}*` },
          { 'Busca': `*${query}*` },
        ]
      : [{}];
    return this.fm.findRecords('Phone_Ldir_Llista', q, { limit, offset }).pipe(
      map(res => ({
        total: res.response.dataInfo.foundCount,
        items: res.response.data.map(r => ({
          recordId: r.recordId,
          modId: r.modId,
          idDireccio: String(r.fieldData['Id_Direccio'] ?? ''),
          nomDireccio: String(r.fieldData['Nom_Direccio'] ?? ''),
          direccio: String(r.fieldData['Direccio'] ?? ''),
          poblacio: String(r.fieldData['Poblacio'] ?? ''),
          barri: String(r.fieldData['Barri'] ?? ''),
          provincia: String(r.fieldData['Provincia'] ?? ''),
          empresa: String(r.fieldData['Empresa'] ?? ''),
          listContactes: String(r.fieldData['List_Contactes'] ?? ''),
          etiquetaProv: String(r.fieldData['Etiqueta_Prov'] ?? ''),
          etiquetaDireccio: String(r.fieldData['Etiqueta_Direccio'] ?? ''),
        })),
      })),
    );
  }

  list(limit = 50, offset = 0): Observable<{ items: DireccioItem[]; total: number }> {
    return this.fm.listRecords('Phone_Ldir_Llista', { limit, offset }).pipe(
      map(res => ({
        total: res.response.dataInfo.totalRecordCount,
        items: res.response.data.map(r => ({
          recordId: r.recordId,
          modId: r.modId,
          idDireccio: String(r.fieldData['Id_Direccio'] ?? ''),
          nomDireccio: String(r.fieldData['Nom_Direccio'] ?? ''),
          direccio: String(r.fieldData['Direccio'] ?? ''),
          poblacio: String(r.fieldData['Poblacio'] ?? ''),
          barri: String(r.fieldData['Barri'] ?? ''),
          provincia: String(r.fieldData['Provincia'] ?? ''),
          empresa: String(r.fieldData['Empresa'] ?? ''),
          listContactes: String(r.fieldData['List_Contactes'] ?? ''),
          etiquetaProv: String(r.fieldData['Etiqueta_Prov'] ?? ''),
          etiquetaDireccio: String(r.fieldData['Etiqueta_Direccio'] ?? ''),
        })),
      })),
    );
  }
}
