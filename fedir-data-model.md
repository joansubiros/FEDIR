# Modelo de datos FEDIR — extraído del DDR 29/08/2026

**FMS 21.1.3** — `FEDIR_data.fmp12` (datos) + `FEDIR.fmp12` (lógica, 274 scripts, 57 layouts).
**Privileges**: 8 cuentas activas en `[fmSuit]` con `fmrest`+`fmodata` (jefe `fbellota` y operario `scoronel` verificados contra Data API).
**Patrón Data API**: todas las llamadas de la app van a `https://fmsuit.cat/fmi/data/vLatest/databases/FEDIR/...` — los layouts PHONE viven en `FEDIR.fmp12` y leen datos de `FEDIR_data` vía TOs externas. Login con `POST /sessions` (Basic) → `Bearer {token}`; logout `DELETE /sessions/{token}`. CORS actual solo permite `127.0.0.1` — pendiente que admin añada el dominio de Firebase.
**Operarios**: `PERSONAL` (`Usuari_Nom`/`Password`, `Flag_Actiu`, `Flag_Xofer`, `Perm_Clients/Ruta/Prov/Vehicles/PuntsRecoll/SetUp/FPag`).

## Tablas base (18) en FEDIR_data

| Tabla | Campos clave | Notas MVP |
|---|---|---|
| `RUTA` | `Id_Ruta`, `Id_Ruta_serial`, `Data`, `Id_Vehicle`, `Id_Personal_1/2/3`, `Count_Punts`, `Count_Punts_Pendents`, `Temps_Privisio_txt`, `Km_Privisio`, `Estat`, `Quant_L/Kg`, `HTML_Mapa`, `URL_Maps` | Cabecera de ruta. Portal `portal_1` → `LRUTA` (7 paradas típicas). |
| `LRUTA` | `Id_LRuta`, `Id_Ruta`, `Id_LDireccio`, `Id_Proveidor`, `Id_Client`, `Quant_L`, `Quant_Kg`, `Quant_Cont_Entregats/Recollits`, `Flag_Fet`, `Flag_Anulat`, `Motiu_Anulat`, `Preu_ud`, `Total` | Parada. Ventanas, contacto y geodata vía `LDIRECCIONS` (`H_Desde/H_Fins`, `Latitud/Longitud`, `Nom_Direccio`, `Etiqueta_Direccio`). |
| `LDIRECCIONS` | `Id_Direccio`, `Nom_Direccio`, `Direccio`, `Poblacio`, `Provincia`, `Latitud`, `Longitud`, `H_Desde`, `H_Fins`, `Dies_Obert`, `Frequencia`, `Tipus_Contenidor`, `Quant_Contenidor`, `Tipus_ud`, `Preu_ud`, `Zona_Fedir`, `Flag_Servei`, `Id_Xofer` | Paradas. `Phone_Ldir_Llista` filtra por `Busca`. |
| `PESOS` | `Id_Pes`, `Data_Pes`, `Pes_Entrant/Sortint/Net`, `Volum_Litres`, `Preu_L/Kg`, `Id_Vehicle`, `Matricula`, `Id_Personal` | `Pes_FormWeb_PSOS` → `Pes_App_Save`. |
| `PROVEIDORS` | `Id_Proveidor`, `Empresa`, `CUIT`, `Tel_1..4`, `Email_1/2`, `Direccio/Poblacio/CP/Provincia`, `Forma_Cobro`, `CBU/CVU` | `Prov_FormWeb_PSOS` → `Prov_App_Save`. |
| `PERSONAL` | `Id_Personal`, `Usuari_Nom/Password`, `Perm_*`, `Flag_Actiu/Xofer` | Auth + RBAC por `Perm_*`. |
| `VEHICLES` | `Id_Vehicle`, `Matricula`, `Marca`, `Model`, `Latitud`, `Longitud` | Joins vía `ruta_VEHICLES::Matricula`. |
| `LCONTACTES`, `CLIENTS`, `NOTES`, `FPAGAMENT`, `EMPRESES`, `POBLACIONS`, `PROVINCIES`, `LCHATBOT`, `SELECTOR`, `CONNECTOR`, `ZRESOURCES` | ver DDR `FEDIR_data.xml` §FieldCatalog | `ZRESOURCES::Perm_*` controla acceso a filas. |

## Layouts PHONE (arranque de la app) — FEDIR.fmp12

| Layout | TO | Campos (`fieldData`/`portalData`) | Portal |
|---|---|---|---|
| `Phone_Ruta_List` | `RUTA` | `Id_Ruta_serial`, `Data`, `ruta_VEHICLES::Matricula`, `Count_Punts`, `Count_Punts_Pendents` | — |
| `Phone_Ruta` | `RUTA` | `Id_Personal_1/2/3`, `Id_Vehicle`, `Data`, `Temps_Privisio_txt`, `Km_Privisio` | `portal_1` = LRUTA→LDIRECCIONS (`Nom_Direccio`, `Tel_1`, `H_Desde/H_Fins`), `portal_2` = CLIENTS |
| `Phone_Ruta_New` | `RUTA` | `Id_Personal_1/2/3`, `Id_Vehicle`, `Data` | — |
| `Phone_LRuta` | `LRUTA` | `Quant_Cont_Entregats/Recollits`, `Quant_Kg/L`, `Preu_ud`, `Total`, `Flag_Fet/Anulat`, `Motiu_Anulat`, `Observacions` + LDIRECCIONS (`Etiqueta_Direccio`, `Frequencia`, `Quant_Contenidor`, `Tipus_Contenidor`, `Tipus_ud`) | — |
| `Phone_Ldir_Llista` | `LDIRECCIONS` | `Busca` (global), `Nom_Direccio`, `Direccio`, `Poblacio`, `Barri`, `Provincia`, `Empresa`, `List_Contactes`, `Etiqueta_Prov/Dir` | — |

Verificado contra Data API (fbellota + scoronel): `GET layouts/Phone_Ruta_List/records?_limit=5`, `GET layouts/Phone_Ruta/records/{id}` (con `portal_1/2`), `GET layouts/Phone_LRuta/records`.

## Scripts relevantes (FEDIR.fmp12)

Rutas: `Ruta_Commit/PSOS`, `Ruta_Nou/Accept`, `Ruta_Accept_Phone`, `Ruta_Lin_Edit/Accept/Delete`, `Ruta_NouPunt/Punt_Accept/Set_Client`, `Ruta_Optima/PSOS`, `Ruta_Open_Maps/URLMaps_PSOS`, `LRuta_Commit/PSOS`, `LRuta_SendAvis/Anulat`.
Pesos/Proveedores/Direcciones: `Pes_FormWeb_PSOS`, `Prov_FormWeb_PSOS`, `Ldir_ChatBot_*`, `Ldir_get_GPS`, `Client/Vehic_get_GPS`, `Send_cURL`.

## Decisiones derivadas

- **Base de datos para Data API = `FEDIR`** (no `FEDIR_data`). Los layouts APP_ nuevos van en `FEDIR.fmp12`.
- **Hosting = Firebase Hosting**; pendiente admin FMS añadir dominio Firebase a CORS. Proxy no necesario.
- Envolver scripts existentes con `*_App_*` en lugar de editarlos; layouts `APP_*` mínimos.
