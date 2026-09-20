# CORS configuration for FEDIR — FileMaker Data API

## Problem

The FEDIR PWA is hosted on **Firebase Hosting** at `https://fedir-app.web.app`,
while the FileMaker Data API lives at `https://fmsuit.cat/fmi/data/vLatest/`.
This is a **cross-origin** request (different host, different protocol),
so the browser enforces CORS.

The Data API at `fmsuit.cat` currently does not return
`Access-Control-Allow-Origin` headers, blocking all API calls from the app.

## Solution for FEDIR

The admin of `fmsuit.cat` (FileMaker Server) must add CORS headers for
`https://fedir-app.web.app` in the server's Apache config.

### Required headers

Inside the `<Location "/fmi">` block in FileMaker Server's Apache config:

```apache
<Location "/fmi">
    Header set X-Content-Type-Options nosniff

    # CORS for Firebase Hosting (https://fedir-app.web.app)
    Header always set Access-Control-Allow-Origin "https://fedir-app.web.app"
    Header always set Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization, odata-maxversion, odata-version, Prefer, OData-MaxVersion, OData-Version"
    Header always set Access-Control-Allow-Methods "PATCH, GET, POST, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Credentials "true"

    # Return 200 for OPTIONS preflight
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^ - [R=200,L]

</Location>
```

Key differences from the LAN example (`plans/howto_cors.md` original):

- **No RewriteCond/Allow-Origin env var** — Firebase Hosting URL is fixed,
  so we can hardcode it directly (no need to reflect arbitrary LAN origins).
- **No port in Origin** — Firebase Hosting uses HTTPS (port 443) without a port.
- **Authorization header** — The app uses Basic auth (FM username/password)
  in the `Authorization` header for login, which must be allowed.

### Which config file to edit

FileMaker Server on macOS keeps two config files in
`/Library/FileMaker Server/HTTPServer/conf/`:

| File | Role |
| ---- | ---- |
| `httpd.conf.2.4` | Source config. Edited by the admin. |
| `httpd.conf` | The file FMS's Apache **actually loads** when HTTP/2 is **off** (the default). |

Check which protocol is active:

```bash
curl -I -k --http2 https://fmsuit.cat/fmi/webd 2>/dev/null | grep HTTP
```

- `HTTP/2`  → edit `httpd.conf.2.4` (loaded directly).
- `HTTP/1.1` → edit `httpd.conf` (the generated file FMS loads). Also apply
  the same edits to `httpd.conf.2.4` so they stay in sync.

> **Note**: In practice, `httpd.conf` is **not** always regenerated from
> `httpd.conf.2.4` on every restart. Treat both as standalone files and keep
> them in sync manually.

### Remove old global CORS headers

Find these lines (outside the `<Location>` block, further down in the file)
and **delete or comment them out**:

```apache
# Add headers for Cross-Origin Resource Sharing (CORS) policies
Header set Access-Control-Allow-Origin ${SERVER_NAME}
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
Header set Access-Control-Allow-Credentials "true"
```

These set `Access-Control-Allow-Origin` to `${SERVER_NAME}` (the server's
internal hostname), which conflicts with the per-origin policy.

## Apply and restart

`fmsadmin restart wpe` only restarts the Web Publishing Engine, **not**
Apache. A full FMS restart is required to reload `httpd.conf`:

```bash
# Validate config syntax first
httpd -t

# Full FMS restart (restarts Apache + all FMS processes)
sudo launchctl stop com.filemaker.fms
sudo launchctl start com.filemaker.fms
```

---

## Solution for FileMaker Server on Windows (IIS)

On Windows Server, FileMaker Server uses **IIS** and the configuration lives in:
`C:\Program Files\FileMaker\FileMaker Server\HTTPServer\conf\web.config`

### 1. Add CORS Preflight rule in `<rewrite><rules>`

```xml
<rule name="CORS Preflight" stopProcessing="true">
  <match url=".*" />
  <conditions>
    <add input="{REQUEST_METHOD}" pattern="^OPTIONS$" />
  </conditions>
  <action type="CustomResponse" statusCode="200" statusReason="OK" statusDescription="Preflight OK" />
</rule>
```

### 2. Configure `<httpProtocol><customHeaders>`

```xml
<httpProtocol>
  <customHeaders>
    <add name="X-Frame-Options" value="SAMEORIGIN" />
    <add name="X-XSS-Protection" value="1; mode=block" />
    <add name="Access-Control-Allow-Origin" value="https://fedir-app.web.app" />
    <add name="Access-Control-Allow-Headers" value="Origin, X-Requested-With, Content-Type, Accept, Authorization, odata-maxversion, odata-version, Prefer, OData-MaxVersion, OData-Version" />
    <add name="Access-Control-Allow-Methods" value="GET, POST, PUT, PATCH, DELETE, OPTIONS" />
    <add name="Access-Control-Allow-Credentials" value="true" />
  </customHeaders>
</httpProtocol>
```

### 3. Restart IIS (as Administrator)

```powershell
iisreset
```


Wait ~10 seconds for FMS to fully start.

## Verify

```bash
curl -ksS -X OPTIONS \
  -H "Origin: https://fedir-app.web.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  -D - -o /dev/null \
  "https://fmsuit.cat/fmi/data/vLatest/databases/FEDIR_data/sessions"
```

Expected response headers:

```text
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://fedir-app.web.app
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, odata-maxversion, odata-version, Prefer, OData-MaxVersion, OData-Version
Access-Control-Allow-Methods: PATCH, GET, POST, DELETE, OPTIONS
Access-Control-Allow-Credentials: true
```

If `Access-Control-Allow-Origin` is missing or the Allow-Headers still shows
the old value, the config wasn't reloaded — do the full `launchctl` restart,
not just `fmsadmin restart wpe`.

## Troubleshooting

### Edits not taking effect

1. Confirm the edits are in the file FMS actually loads (see "Which config
   file to edit" above).
2. Use `sudo launchctl stop/start com.filemaker.fms`, **not** `fmsadmin
   restart wpe`.
3. Check for overriding `Include` files:

   ```bash
   grep -rn "Access-Control-Allow" '/Library/FileMaker Server/HTTPServer/conf/extra/'
   ```

### Still getting 405 on preflight

The `OPTIONS` RewriteRule isn't firing. Verify `mod_rewrite` is loaded
(`LoadModule rewrite_module`) and that `RewriteEngine On` is inside the
`<Location>` block.

### `Access-Control-Allow-Origin` header missing

For a hardcoded origin, simply ensure the `Header always set
Access-Control-Allow-Origin` line is present and not overridden by a later
`Header unset` directive.

## Security notes

- `Access-Control-Allow-Origin` is hardcoded to `https://fedir-app.web.app`
  only — no other origins are allowed.
- `Access-Control-Allow-Credentials: true` is required for Basic auth
  (FM username/password) but should not be used with `Access-Control-Allow-
  Origin: *`.
- FMS may overwrite `httpd.conf` on a future update/reinstall. Reapply the
  edits if that happens, and keep `httpd.conf.2.4` in sync as a backup.
