import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
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
  getDetalle(recordId: string): Observable<RutaDetalle> {
    return this.fm.getRecord('Phone_Ruta', recordId).pipe(
      map(res => {
        const r = res.response.data[0];
        const p1 = (r.portalData?.['portal_1'] ?? []) as unknown as Record<string, unknown>[];
        const p2 = (r.portalData?.['portal_2'] ?? []) as unknown as Record<string, unknown>[];
        return {
          recordId: r.recordId,
          modId: r.modId,
          fieldData: {
            Id_Personal_1: String(r.fieldData['Id_Personal_1'] ?? ''),
            Id_Personal_2: String(r.fieldData['Id_Personal_2'] ?? ''),
            Id_Personal_3: String(r.fieldData['Id_Personal_3'] ?? ''),
            Id_Vehicle: String(r.fieldData['Id_Vehicle'] ?? ''),
            Data: String(r.fieldData['Data'] ?? ''),
            Temps_Privisio_txt: String(r.fieldData['Temps_Privisio_txt'] ?? ''),
            Km_Privisio: Number(r.fieldData['Km_Privisio'] ?? 0),
          },
          portalParadas: p1.map(x => ({
            recordId: String((x as Record<string, unknown>)['recordId'] ?? ''),
            modId: String((x as Record<string, unknown>)['modId'] ?? ''),
            nomDireccio: String((x as Record<string, unknown>)['ruta_lruta_LDIRECCIONS::Nom_Direccio'] ?? ''),
            tel1: String((x as Record<string, unknown>)['ruta_lruta_ldir_LCONTACTES::Tel_1'] ?? ''),
            hDesde: String((x as Record<string, unknown>)['ruta_lruta_LDIRECCIONS::H_Desde'] ?? ''),
            hFins: String((x as Record<string, unknown>)['ruta_lruta_LDIRECCIONS::H_Fins'] ?? ''),
          })),
          portalClientes: p2.map(x => ({
            recordId: String((x as Record<string, unknown>)['recordId'] ?? ''),
            idClientPrint: String((x as Record<string, unknown>)['CLIENTS::Id_Client_Print'] ?? ''),
            nomEmpresa: String((x as Record<string, unknown>)['CLIENTS::Nom_Empresa'] ?? ''),
          })),
        };
      }),
    );
  }

  create(data: { Data: string; Id_Vehicle: string; Id_Personal_1?: string; Id_Personal_2?: string; Id_Personal_3?: string }): Observable<{ recordId: string }> {
    return this.fm.createRecord('Phone_Ruta_New', data as Record<string, unknown>).pipe(
      map(r => ({ recordId: r.response.recordId })),
    );
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
        return {
          recordId: r.recordId,
          modId: r.modId,
          quantContEntregats: fd['Quant_Cont_Entregats'] === '' || fd['Quant_Cont_Entregats'] == null ? null : Number(fd['Quant_Cont_Entregats']),
          quantContRecollits: fd['Quant_Cont_Recollits'] === '' || fd['Quant_Cont_Recollits'] == null ? null : Number(fd['Quant_Cont_Recollits']),
          quantKg: fd['Quant_Kg'] === '' || fd['Quant_Kg'] == null ? null : Number(fd['Quant_Kg']),
          quantL: fd['Quant_L'] === '' || fd['Quant_L'] == null ? null : Number(fd['Quant_L']),
          preuUd: Number(fd['lruta_LDIRECCIONS::Preu_ud'] ?? 0),
          total: Number(fd['Total'] ?? 0),
          tipUsUd: String(fd['lruta_LDIRECCIONS::Tipus_ud'] ?? ''),
          tipUsContenidor: String(fd['lruta_LDIRECCIONS::Tipus_Contenidor'] ?? ''),
          quantContenidor: Number(fd['lruta_LDIRECCIONS::Quant_Contenidor'] ?? 0),
          flagFet: String(fd['Flag_Fet'] ?? ''),
          flagAnulat: String(fd['Flag_Anulat'] ?? ''),
          motiuAnulat: String(fd['Motiu_Anulat'] ?? ''),
          observacions: String(fd['Observacions'] ?? ''),
          etiquetaDireccio: String(fd['lruta_LDIRECCIONS::Etiqueta_Direccio'] ?? ''),
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
}

@Injectable({ providedIn: 'root' })
export class DireccioService {
  constructor(private fm: FileMakerService) {}

  search(query: string, limit = 50, offset = 0): Observable<{ items: DireccioItem[]; total: number }> {
    const q: Record<string, unknown>[] = query ? [{ 'LDIRECCIONS::Nom_Direccio': `*${query}*` }] : [{}];
    return this.fm.findRecords('Phone_Ldir_Llista', q, { limit, offset }).pipe(
      map(res => ({
        total: res.response.dataInfo.foundCount,
        items: res.response.data.map(r => ({
          recordId: r.recordId,
          modId: r.modId,
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
