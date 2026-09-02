# Plan: FEDIR — App móvil para operarios (Ionic + Capacitor, PWA primero, backend FileMaker Data API)

> **Actualizado 29/08/2026** tras analizar el DDR entregado en `C:\Users\jsubi\Documents\Projects\fedir\` (`FEDIR.xml`, `FEDIR_fmp12.xml`, `FEDIR_data.xml`, `FEDIR_data_fmp12.xml`, `Summary.xml`).

## Objetivo

Reemplazar el uso de WebDirect en móvil por una app propia para los operarios de FEDIR. El backend sigue siendo FileMaker Server en `https://fmsuit.cat` (modelo de separación: `FEDIR_data.fmp12` datos + `FEDIR.fmp12` lógica/scripts).

## Contexto verificado

- WebDirect va mal en móvil: reenvía toda la UI por HTTP y las sesiones se cortan. Es el problema a resolver.
- La **Data API ya está operativa en producción** en `fmsuit.cat`: los workflows n8n existentes (`FEDIR_Pesaje`, `FEDIR_Form`, `FEDIR_Chatbot`) usan Data API sobre layouts `PROVEIDORS` y `LDIRECCIONS` con scripts `Pes_FormWeb_PSOS`, `Prov_FormWeb_PSOS`, `Ldir_ChatBot_*`.
- El ecosistema `fms-odata-mcp` ya existe para `FEDIR_data` (útil para discovery/automatización, **no** como capa de datos de la app).
- **DDR obtenido y analizado (29/08/2026)** — FileMaker Server **21.1.3**:
  - `FEDIR.fmp12` (lógica): 2 tablas base propias (`LIVA`, `LV`), 82 table occurrences (referencias externas a `FEDIR_data`), **57 layouts**, **274 scripts**, 8 cuentas, 4 privilege sets, extended privileges con **`fmrest` y `fmodata`**.
  - `FEDIR_data.fmp12` (datos): **18 tablas base**, 37 layouts, 9 scripts (solo cuentas/duplicados/provas), 8 cuentas, 4 privilege sets, extended privileges con **`fmrest` y `fmodata`**.
- **Las tablas de rutas YA existen**: `RUTA` (cabecera) y `LRUTA` (paradas/líneas de ruta). No hay que crearlas.
- **Ya hay scripts de rutas en FileMaker**: `Ruta_Optima`/`Ruta_Optima_PSOS` (optimización), `Ruta_Open_Maps`/`Ruta_URLMaps_PSOS` (navegación), `Ruta_Accept_Phone`, `Ruta_Lin_Edit/Accept/Delete`, `Ruta_NouPunt`/`Ruta_Punt_Accept`/`Ruta_Set_Client`, `Ruta_Send_Avis`, `LRuta_*`, además de `Ldir_get_GPS`, `Client_get_GPS`, `Vehic_get_GPS` y `Send_cURL`.
- **Ya existe una interfaz móvil WebDirect** que auditar/reemplazar: layouts `Phone_Ruta_List`, `Phone_Ruta`, `Phone_Ruta_New`, `Phone_LRuta`, `Phone_Ldir_Llista`.
- **Los operarios son registros de `PERSONAL`** con credenciales y permisos por operario: `Usuari_Nom`, `Usuari_Password`, `Flag_Actiu`, `Flag_Xofer` y flags `Perm_Clients`, `Perm_Ruta`, `Perm_Prov`, `Perm_Vehicles`, `Perm_PuntsRecoll`, `Perm_SetUp`, `Perm_FPag`, `Perm_Empresa_Id`.

## Decisiones acordadas con el usuario

| Tema | Decisión |
|---|---|
| Backend app | **FileMaker Data API** (`https://fmsuit.cat/fmi/data/vLatest`). OData/MCP quedan como complementarios. |
| Frontend | **Ionic + Angular + Capacitor**. |
| Distribución | **PWA primero** (sin stores); envoltorio nativo Capacitor más adelante si se decide. **Hosting: Firebase Hosting**, proyecto `fedir-app`, dominio **https://fedir-app.web.app** (deployado). |
| CORS | **Habilitar CORS en FMS** (admin añade el dominio de Firebase a la lista de orígenes permitidos). Sin proxy. |
| Alcance | **MVP acotado** con los flujos de abajo. |
| Auth | **Cuenta FileMaker por operario** (registro `PERSONAL`); `fmrest` **ya existe** en los privilege sets. Token Data API por sesión. |
| Offline | **Online + cola de escrituras local con reintento** (IndexedDB). Nada se pierde si se corta la red. |
| Optimización de rutas | **Reutilizar `Ruta_Optima`/`Ruta_Optima_PSOS` de FileMaker** antes que Google Route Optimization API. Google API solo como post-MVP si la optimización FM no basta. MVP navega con deep links (`Ruta_Open_Maps` ya lo hace). |

### Flujos del MVP (los que hoy se usan por WebDirect + rutas)

1. **Pesaje** (script `Pes_FormWeb_PSOS`, tabla `PESOS`).
2. **Formulario proveedor** (script `Prov_FormWeb_PSOS`, tabla `PROVEIDORS`).
3. **Consulta de direcciones** (tabla `LDIRECCIONS`).
4. **Listado de rutas** y **detalle/introducción de datos de cada ruta**: cabecera `RUTA` + líneas `LRUTA` (ver modelo abajo).
5. **Navegación por parada**: deep links a Waze (`waze://?ll={lat},{lng}&navigate=yes`) y Google Maps (`google.navigation:q={lat},{lng}` o `https://www.google.com/maps/dir/?api=1&destination=...`). `LDIRECCIONS` ya tiene `Latitud`/`Longitud`.

### Pantallas de arranque (grupo PHONE de WebDirect → App)

El proyecto **empieza replicando estas 5 pantallas WebDirect** (layouts en `FEDIR.fmp12`), que definen el alcance inicial. Composición de campos extraída del DDR:

| Layout WebDirect | TO | Pantalla app | Campos mostrados |
|---|---|---|---|
| `Phone_Ruta_List` | RUTA | Listado de rutas | `Nom`, `Id_Ruta_serial`, `Data`, `Matricula`, `Count_Punts`, `Count_Punts_Pendents` |
| `Phone_Ruta` | RUTA | Detalle de ruta + paradas | `Nom`, `Id_Personal_1/2/3`, `Id_Vehicle`, `Data`, portal LRUTA (`Id_LRuta_serial`, `Nom_Direccio`, `Tel_1`, `Nom_Empresa`, `H_Desde`, `H_Fins`), `Temps_Privisio_txt`, `Km_Privisio` |
| `Phone_Ruta_New` | RUTA | Nueva ruta | `Nom`, `Id_Personal_1/2/3`, `Id_Vehicle`, `Data` |
| `Phone_LRuta` | LRUTA | Detalle/edición de parada | `Nom_Direccio`, `Etiqueta_Direccio`, `Quant_Cont_Recollits`, `Quant_Cont_Entregats`, `Quant_Kg`, `Quant_L`, `Preu_ud`, `Total`, `Tipus_ud`, `Tipus_Contenidor`, `Quant_Contenidor`, `Frequencia`, `Flag_Fet`, `Flag_Anulat`, `Motiu_Anulat`, `Observacions`, `Tel_1`, `Nom` |
| `Phone_Ldir_Llista` | LDIRECCIONS | Búsqueda de direcciones | `Busca`, `Nom_Direccio`, `Direccio`, `Poblacio`, `Barri`, `Provincia`, `Empresa`, `List_Contactes`, `Etiqueta_Prov`, `Etiqueta_Direccio` |

> Nota: varios campos son de tablas relacionadas (`Nom`, `Matricula`, `Nom_Direccio`, `Empresa`, `List_Contactes`, `Tel_1`), lo que confirma que las relaciones/portales ya existen y la app puede leerlos con `expand`/portales en una sola llamada.

## Modelo de datos verificado (DDR)

Tablas relevantes para el MVP (todas en `FEDIR_data.fmp12`):

### `RUTA` — cabecera de ruta (29 campos)
- Identidad: `Id_Ruta`, `Id_Ruta_serial`, `Data` (fecha), `Data_Avui`.
- Asignación: `Id_Vehicle`, `Id_Personal_1`, `Id_Personal_2`, `Id_Personal_3`.
- Estado/progreso: `Estat`, `Count_Punts`, `Count_Punts_Pendents`.
- Totales: `Quant_L`, `Quant_Kg`, `Sum_Kg`, `Sum_L`, `Total`.
- Previsión/optimización: `Temps_Privisio`, `Km_Privisio`, `Temps_Privisio_txt`, `HTML_Mapa`, `URL_Maps`.
- Otros: `Observacions`, `Control_Dup`.

### `LRUTA` — parada / línea de ruta (25 campos)
- Identidad: `Id_LRuta`, `Id_LRuta_serial`, `Id_Ruta` (FK → `RUTA`).
- Destino: `Id_LDireccio` (FK → `LDIRECCIONS`), `Id_Proveidor`, `Id_Client`.
- Cantidades: `Quant_L`, `Quant_Kg`, `Quant_Cont_Entregats`, `Quant_Cont_Recollits`, `Total`, `Preu_ud`.
- Estado: `Flag_Fet`, `Flag_Anulat`, `Motiu_Anulat`, `Observacions`.
- Otros: `Data`, `Control_Dup`, `var_1`.

### `LDIRECCIONS` — direcciones/paradas (46 campos)
- Identidad: `Id_Direccio`, `Id_Direccio_serial`, `Id_Client`, `Id_Proveidor`.
- Geo y navegación: `Latitud`, `Longitud`, `Direccio`, `CP`, `Poblacio`, `Provincia`, `Pais`, `Barri`, `HTML_Map`.
- Ventana/planificación: `H_Desde`, `H_Fins` (Time), `Dies_Obert`, `Frequencia`.
- Servicio: `Tipus_Contenidor`, `Quant_Contenidor`, `Tipus_ud`, `Preu_ud`, `Zona_Fedir`, `Flag_Servei`.
- Otros: `Id_Xofer`, `Nom_Contacte`, `Flag_Actiu`, `Observacions`.

### `PESOS` — pesajes (30 campos)
- Identidad: `Id_Pes`, `Id_Pes_serial`, `Data_Pes`.
- Pesos: `Pes_Entrant`, `Pes_Sortint`, `Pes_Net`, `Volum_Litres`, `Preu_L`, `Preu_Kg`, `Total`, `Sum_Volum`, `Sum_Kg`, `Sum_Total`.
- Contexto: `Id_Vehicle`, `Matricula`, `Id_Personal`, `Nom_Conductor`, `Lloc`, `Unitat`, `Cobrat`, `Data_Cobrat`.
- Otros: `Any_Pes`, `Mes_Pes`, `Any_Mes_Pes`, `Observacions`.

### `PROVEIDORS` — proveedores (64 campos)
- Identidad: `Id_Proveidor`, `Id_Prov_Serial`, `Nom_Comercial`, `Empresa`, `CUIT`, `Tipus_Prov`.
- Contacto: `Tel_1..4` (+ `Tipus_tel_*`), `Email_1/2`, `Website`, `Idioma`.
- Dirección/fiscal: `Direccio`, `Poblacio`, `CP`, `Provincia`, `Pais`, `Barri`, `Codi_Poblacio`.
- Pago: `Forma_Cobro`, `Termini_Cobro`, `Banc_nom`, `CBU`, `CVU`, `Alias_Banc`, `Id_Fpag`, `IRPF_percent`, `IVA_percent`.
- Control: `Flag_Actiu`, `Control_Direccio`, `Control_Duplicat`, `Flag_ClientExtern`.

### `PERSONAL` — operarios (44 campos)
- Identidad: `Id_Personal`, `Id_Personal_serial`, `Nom`, `Cognoms`, `Alies`, `DNI`, `Foto`.
- **Login**: `Usuari_Nom`, `Usuari_Password`, `Flag_Actiu`, `Flag_Xofer`.
- **Permisos**: `Perm_Clients`, `Perm_Ruta`, `Perm_Prov`, `Perm_Vehicles`, `Perm_PuntsRecoll`, `Perm_SetUp`, `Perm_FPag`, `Perm_Empresa_Id`.
- Otros: `Sou_Net`, `Seg_Social`, `Cost_Hora`, `Email`, `Categoria`.

### Otras tablas
- `VEHICLES` (20 campos): `Id_Vehicle`, `Matricula`, `Marca`, `Model`, `Tipus_Vehicle`, `Capacitat`, `Long_total`, `Ample`, `Latitud`, `Longitud`.
- `LCONTACTES` (21), `CLIENTS` (externo), `NOTES`, `FPAGAMENT`, `EMPRESES`, `POBLACIONS`, `PROVINCIES`, `LCHATBOT`, `SELECTOR`, `CONNECTOR`, `ZRESOURCES`.

### Scripts clave (en `FEDIR.fmp12`, 274 scripts)
- **Rutas**: `Ruta_Commit`/`Ruta_Commit_PSOS`, `Ruta_Nou`/`Ruta_Nou_Accept`, `Ruta_Fitxa`, `Ruta_Llistat`, `Ruta_Accept_Phone`, `Ruta_Lin_Edit`/`Ruta_Lin_Accept`/`Ruta_Lin_Delete`, `Ruta_NouPunt`/`Ruta_Punt_Accept`/`Ruta_Set_Client`, `Ruta_Optima`/`Ruta_Optima_PSOS`, `Ruta_Open_Maps`/`Ruta_URLMaps_PSOS`, `Ruta_Send_Avis`/`Ruta_SendAvis_PSOS`, `LRuta_Commit`/`LRuta_Commit_PSOS`, `LRuta_SendAvis`/`LRuta_SendAnulat`.
- **Pesaje**: `Pes_commit`, `Pes_Nou`, `Pes_Fitxa`, `Pes_Llistat`, `Pes_FormWeb_PSOS`.
- **Proveedor**: `Prov_Commit`/`Prov_Commit_PSOS`, `Prov_Nou`, `Prov_Fitxa`, `Prov_FormWeb_PSOS`.
- **Direcciones**: `Ldir_Commit`/`Ldir_Commit_PSOS`, `Ldir_Fitxa`, `Ldir_get_GPS`, `Ldir_Mapa`/`Ldir_Mapa_PSOS`, `Ldir_ChatBot_*`.
- **Infra**: `Send_cURL`, `Server_Diari`, `Get_Lat_Lng`, `Permisos_Seguretat`.

> **Nota de arquitectura a verificar (fase 0)**: los datos están en `FEDIR_data.fmp12` pero los scripts de negocio en `FEDIR.fmp12`. Hay que confirmar cómo apunta hoy n8n (contra qué fichero/layout y cómo ejecuta scripts entre ficheros vía `fmextscriptaccess`) y reutilizar ese patrón ya probado para la app.

## Tareas

### Fase 0 — Discovery
1. ✅ **Obtener el DDR** — ENTREGADO y analizado (29/08/2026). Los XML están en `C:\Users\jsubi\Documents\Projects\fedir\`.
2. ✅ **Auditar los layouts móviles WebDirect** (`Phone_Ruta_List`, `Phone_Ruta`, `Phone_Ruta_New`, `Phone_LRuta`, `Phone_Ldir_Llista`) — identificados como **pantallas de arranque** y composición de campos extraída del DDR (ver sección "Pantallas de arranque"). Pendiente: confirmar scripts disparados por cada pantalla y campos editables vs. solo lectura.
3. **Verificar CORS y patrón Data API real**:
   - El endpoint `POST /fmi/data/vLatest/databases/FEDIR_data/sessions` responde en FMS 21.1.3 (no 404/405) pero las respuestas no traen `Access-Control-Allow-Origin` → el admin de FMS debe añadir el dominio de Firebase Hosting a la lista de orígenes permitidos.
   - Hacer login real con un operario de prueba → leer `LDIRECCIONS` desde navegador para confirmar CORS OK.
   - **Documentar cómo n8n resuelve fichero/layout/script entre `FEDIR.fmp12` y `FEDIR_data.fmp12`** (patrón a reutilizar).
4. Producir `fedir-data-model.md` (borrador ya contenido en este plan, sección "Modelo de datos verificado") + mapeo de los scripts `*_FormWeb_PSOS` y `Ruta_*` a reutilizar.

### Fase 1 — Servidor FileMaker
5. **Ampliar/crear privilege set** con `fmrest` (**ya presente**); restringirlo a los layouts/tablas del MVP y a los scripts `*_App_*` + los existentes que la app necesite ejecutar.
6. Crear **cuenta por operario** a partir de `PERSONAL` (`Usuari_Nom`/`Usuari_Password`) asignada a ese privilege set; respetar los flags `Perm_*` y `Flag_Actiu`/`Flag_Xofer`.
7. Crear scripts API-first para la app (parámetros vía JSON con `JSONGet` del cuerpo, respuesta JSON, validación de usuario): p. ej. `Pes_App_Get/Save`, `Prov_App_Get/Save`, `Dir_App_Find`, `Ruta_App_List/Get/Save`, `LRuta_App_Save`. **Envolver la lógica existente** (`*_FormWeb_PSOS`, `Ruta_*`, `LRuta_*`) en vez de duplicarla.
8. Crear layouts ligeros prefijados `APP_*` solo con los campos que la app necesita (payload mínimo). Decidir en qué fichero viven (ver nota de arquitectura) y cómo se ejecutan los scripts de `FEDIR.fmp12` desde Data API.

### Fase 2 — Scaffold de la app (repo en `C:\Users\jsubi\Documents\Projects\fedir\fedir-app`)
9. `ionic start fedir-app blank --type=angular --capacitor` + `npx cap add android` e `ios` (proyecto preparado para envoltorio futuro aunque primero sea PWA). Configurar app id `cat.fmsuit.fedir`. — **HECHO**: Angular 22 + Ionic 8 (NgModule), `@capacitor/core` + `capacitor.config.ts`, `@angular/service-worker` + `manifest.webmanifest` + `ngsw-config.json`, `firebase.json`/`.firebaserc` para hosting.
10. `FileMakerService`: login (`POST /sessions` con Basic → token), logout (`DELETE /sessions/{token}`), CRUD por layout, `executeScript`, manejo de errores (105/401 → re-login; reintentos con backoff). Los tokens Data API caducan (~15 min) y se renuevan con cualquier llamada. — **HECHO** en `src/core/services/filemaker.service.ts`.
11. Interceptor HTTP: `Authorization: Bearer {token}` + re-auth automático en 401; credenciales en almacenamiento cifrado si es build nativo, o sessionStorage con aviso si es PWA. — **HECHO** en `src/core/interceptors/fm-auth.interceptor.ts` + `src/core/services/session.service.ts`.
12. `WriteQueueService` sobre IndexedDB (`idb`): toda escritura de operario pasa por la cola, reintento hasta confirmación, indicador de sincronización en UI, drenado al volver cobertura. — **HECHO** en `src/core/services/write-queue.service.ts` + `write-queue-sync.service.ts`.
13. PWA: `ng add @angular/pwa`, manifest, service worker solo para assets; datos siempre vía Data API + caché de solo lectura para listados frecuentes. — **HECHO** (instalación manual por incompatibilidad Node 25).
14. Aplicar los estándares de rendimiento existentes (skills `fmsuit-ionic-performance` y `fmsuit-performance-standard`): OnPush + async pipe, `ionViewWillEnter/WillLeave`, infinite scroll con `_offset/_limit`, prohibidas consultas N+1 (los relacionados via `expand`/portales en una llamada). — **HECHO**: todas las páginas con `OnPush`, `infinite-scroll` con `_limit/_offset`, portales en una sola llamada.

### Fase 3 — Flujos del MVP (empezando por las pantallas PHONE)
15. Login + home con accesos a los flujos, estado de conexión y filtrado por flags `Perm_*` del operario. — **HECHO**: `src/features/auth/login.page` + `AuthGuard`.
16. **Rutas — listado** (`Phone_Ruta_List`): lista de `RUTA` por `Data`/operario con `Matricula`, `Count_Punts`, `Count_Punts_Pendents`. — **HECHO**: `src/features/rutas/rutas-list.page` (infinite scroll, OnPush, pull-to-refresh).
17. **Rutas — nueva** (`Phone_Ruta_New`): crear ruta con `Data`, `Id_Vehicle`, `Id_Personal_1/2/3`. — **HECHO**: `src/features/rutas/ruta-new.page` (con fallback a cola offline).
18. **Rutas — detalle** (`Phone_Ruta`): cabecera + portal de paradas `LRUTA` con ventanas `H_Desde`/`H_Fins`, previsión `Temps_Privisio_txt`/`Km_Privisio`, botón navegar (Waze/Maps) y completar parada. — **HECHO**: `src/features/rutas/ruta-detalle.page`.
19. **Parada — detalle/edición** (`Phone_LRuta`): introducir/editar `Quant_Cont_Recollits`/`Quant_Cont_Entregats`, `Quant_Kg`, `Quant_L`, `Preu_ud`, estado `Flag_Fet` o `Flag_Anulat`+`Motiu_Anulat`, `Observacions` → escritura encolada vía `LRuta_App_Save`. — **HECHO**: `src/features/paradas/parada-detalle.page` (cola offline en error de red).
20. **Direcciones — búsqueda** (`Phone_Ldir_Llista`): búsqueda sobre `LDIRECCIONS` con infinite scroll y detalle con acción de navegar (`Latitud`/`Longitud`). — **HECHO**: `src/features/direcciones/direcciones.page` (debounce 300 ms).
21. **Pesaje** (`PESOS`): lista de proveedores → formulario de pesaje (`Pes_Entrant`/`Pes_Sortint`/`Pes_Net`, `Volum_Litres`, `Preu_L`/`Preu_Kg`, `Matricula`, `Id_Vehicle`) → guardar vía `Pes_App_Save` (envuelve `Pes_FormWeb_PSOS`) → cola de escrituras.
22. **Formulario proveedor** (`PROVEIDORS`): campos del formulario web actual → `Prov_App_Save`.

### Fase 4 — Pruebas y despliegue PWA
23. Unit tests de `FileMakerService`, `WriteQueueService` (simular pérdida de red) y guards de auth.
24. Desplegar la PWA en Firebase Hosting (**https://fedir-app.web.app**, hecho) y probar en iPhone y Android reales (iOS: añadir a pantalla de inicio; limitaciones PWA iOS: push poco fiable, sin plugins Capacitor).
25. Beta con 3–5 operarios durante ~2 semanas; iterar UX/bugs.

### Fase 5 — Post-MVP (fuera del alcance inicial, dejar preparado)
26. Envoltorio nativo Capacitor → TestFlight/Play interno si se decide salir de PWA.
27. **Optimización de rutas**: primero evaluar `Ruta_Optima`/`Ruta_Optima_PSOS` existentes en FileMaker. Solo si no bastan, plantear Google Route Optimization API (VRPTW), que requiere proyecto Google Cloud + facturación.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| CORS bloqueado o WAF delante de `/fmi/data` | **Resuelto por decisión**: hosting PWA en Firebase → admin FMS añade el dominio Firebase a orígenes permitidos. FMS 21.1.3 lo soporta. Verificación temprana en fase 0.3. |
| Scripts de negocio viven en `FEDIR.fmp12` y datos en `FEDIR_data.fmp12` | Auditar cómo lo resuelve hoy n8n y reutilizar ese patrón (`fmextscriptaccess`); decidir dónde viven los layouts `APP_*` y los scripts `*_App_*`. |
| Credenciales FM en PWA (solo sessionStorage) | Aceptable como app interna; migración a Keychain/Keystore al pasar a nativo (fase 5). |
| `Ruta_Optima` de FM no cubre todas las ventanas horarias | Evaluar calidad primero (fase 0.2/0.4); si no basta, Google Route Optimization API como post-MVP explícito. |
| Scripts FM existentes pensados para web (`*_FormWeb_PSOS`, `Ruta_*`) | Envolver su lógica en scripts `*_App_*` nuevos sin tocar los originales. |

## Validación

- Llamada real de login + lectura de `LDIRECCIONS` desde navegador (CORS OK) y desde la app.
- Cada flujo MVP funciona end-to-end contra `fmsuit.cat` con cuenta de operario real.
- Corte de red simulado durante un guardado → la cola reintenta y el dato llega a FileMaker.
- Beta con operarios: tiempo por pesaje < 30 s y sin cortes de sesión.

## Preguntas abiertas

- **Resuelto**: DDR entregado y analizado.
- **Resuelto**: las tablas de rutas existen (`RUTA` + `LRUTA`), no hay que crearlas.
- **Nuevo**: confirmar cómo n8n apunta hoy a fichero/layout/script (¿`FEDIR_data.fmp12` con scripts de `FEDIR.fmp12` vía `fmextscriptaccess`, o layouts en `FEDIR.fmp12` que referencian las tablas externas?). Decide dónde viven `APP_*` y `*_App_*`.
- Hosting de la PWA: **Firebase Hosting**, proyecto `fedir-app` → **https://fedir-app.web.app** (deployado 29/08/2026). El admin FMS debe añadir `https://fedir-app.web.app` a los orígenes CORS permitidos.
- Admin FMS: añadir el dominio de Firebase Hosting a orígenes CORS permitidos antes de la fase 4.24.
- Operario de prueba: pendiente de que lo compartan por canal seguro para login real.
- ¿Reutilizamos la optimización `Ruta_Optima` de FM en el MVP o la dejamos post-MVP (solo navegación deep-link)?
