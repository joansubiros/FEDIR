export interface FmLoginResponse {
  response: { token: string };
  messages: { code: string; message: string }[];
}

export interface FmError {
  code: string;
  message: string;
}

export interface FmDataInfo {
  database: string;
  layout: string;
  table: string;
  totalRecordCount: number;
  foundCount: number;
  returnedCount: number;
}

export interface FmRecord {
  fieldData: Record<string, unknown>;
  portalData: Record<string, FmRecord[]>;
  recordId: string;
  modId: string;
  portalDataInfo?: { portalObjectName: string; database: string; table: string; foundCount: number; returnedCount: number }[];
}

export interface FmFindResponse {
  response: { dataInfo: FmDataInfo; data: FmRecord[] };
  messages: FmError[];
}

export interface FmSingleResponse {
  response: { dataInfo: FmDataInfo; data: FmRecord[] };
  messages: FmError[];
}

export interface FmCreateResponse {
  response: { recordId: string; modId: string };
  messages: FmError[];
}

export interface FmScriptResponse {
  response: {
    dataInfo: FmDataInfo;
    data: FmRecord[];
    scriptResult: string | null;
    scriptError: string | null;
  };
  messages: FmError[];
}

export interface RutaListItem {
  recordId: string;
  modId: string;
  idRutaSerial: number;
  data: string;
  matricula: string;
  countPunts: number;
  countPuntsPendents: number;
}

export interface RutaDetalle {
  recordId: string;
  modId: string;
  fieldData: {
    Id_Ruta: string;
    Id_Ruta_serial: number;
    Nom_Personal_1: string;
    Nom_Personal_2: string;
    Nom_Personal_3: string;
    Id_Personal_1: string;
    Id_Personal_2: string;
    Id_Personal_3: string;
    Id_Vehicle: string;
    Data: string;
    Temps_Privisio_txt: string;
    Km_Privisio: number;
  };
  portalParadas: RutaParadaPortal[];
  portalClientes: { recordId: string; idClientPrint: string; nomEmpresa: string }[];
}

export interface RutaParadaPortal {
  recordId: string;
  modId: string;
  idLRuta: string;
  idLRutaSerial: number;
  idRuta: string;
  idLDireccio: string;
  idClient: string;
  idClientPrint: string;
  nomEmpresa: string;
  direccio: string;
  nomDireccio: string;
  etiquetaDireccio: string;
  tel1: string;
  hDesde: string;
  hFins: string;
  latitud: number | null;
  longitud: number | null;
  flagFet: string;
  flagAnulat: string;
}

export interface LrutaDetalle {
  recordId: string;
  modId: string;
  idRutaSerial: number;
  quantContEntregats: number | null;
  quantContRecollits: number | null;
  quantKg: number | null;
  quantL: number | null;
  preuUd: number;
  total: number;
  tipUsUd: string;
  tipUsContenidor: string;
  quantContenidor: number;
  flagFet: string;
  flagAnulat: string;
  motiuAnulat: string;
  observacions: string;
  etiquetaDireccio: string;
  nomDireccio: string;
  direccio: string;
  frequencia: number;
  tel1: string;
  nom: string;
}

export interface DireccioItem {
  recordId: string;
  modId: string;
  idDireccio: string;
  nomDireccio: string;
  direccio: string;
  poblacio: string;
  barri: string;
  provincia: string;
  empresa: string;
  listContactes: string;
  etiquetaProv: string;
  etiquetaDireccio: string;
}
