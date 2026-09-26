# Impresión de comandas con QZ Tray

Guía para configurar la impresión silenciosa (sin diálogos) de comandas en impresoras térmicas.

```
Navegador (dashboard) ──► QZ Tray (PC del restaurante) ──► Impresora térmica (ESC/POS)
        │
        └──► /api/qz/cert  → certificado público
        └──► /api/qz/sign  → firma SHA512 con la clave privada (solo usuarios autenticados)
```

Para que QZ Tray **no pida permiso**, dos cosas tienen que coincidir:

1. El **certificado** que sirve la app (`/api/qz/cert`) y la **firma** hecha con su clave privada.
2. Ese mismo certificado instalado como **`override.crt`** en la PC del restaurante.

Si cualquiera de los dos falla, QZ Tray trata las solicitudes como **anónimas** y el botón *Allow*
se deshabilita al marcar *Remember this decision*.

---

## 1. Certificado y clave privada

Si ya tienes `digital-certificate.pem` y `private-key.pem`, salta al paso 2.

Para generarlos (válidos por 10 años):

```bash
openssl req -x509 -newkey rsa:2048 -keyout private-key.pem -out digital-certificate.pem -days 3650 -nodes -subj "/CN=PideLoNuestro"
```

> ⚠️ `private-key.pem` es secreto: nunca lo subas al repositorio ni lo compartas por chat.
> `digital-certificate.pem` es público.

---

## 2. Convertir a base64 (una sola línea)

Las variables se cargan en **base64** porque un PEM de varias líneas se daña fácil al pegarlo
(saltos de línea convertidos en espacios, fragmentos desordenados). En base64 es una sola línea
sin espacios.

Desde la carpeta donde están los `.pem`:

```bash
node -e "const fs=require('fs');for(const [pem,out] of [['digital-certificate.pem','QZ_PUBLIC_CERT_BASE64.txt'],['private-key.pem','QZ_PRIVATE_KEY_BASE64.txt']])fs.writeFileSync(out,Buffer.from(fs.readFileSync(pem,'utf8').replace(/\r/g,'').trim()).toString('base64'))"
```

Genera `QZ_PUBLIC_CERT_BASE64.txt` y `QZ_PRIVATE_KEY_BASE64.txt`.

> ⚠️ `QZ_PRIVATE_KEY_BASE64.txt` es igual de secreto que `private-key.pem` (base64 no es cifrado).

---

## 3. Variables de entorno

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `QZ_PUBLIC_CERT_BASE64` | Contenido de `QZ_PUBLIC_CERT_BASE64.txt` | No |
| `QZ_PRIVATE_KEY_BASE64` | Contenido de `QZ_PRIVATE_KEY_BASE64.txt` | **Sí** |

Nunca uses el prefijo `NEXT_PUBLIC_`: la clave privada solo se lee en el servidor
(`src/lib/printer/qzServerKey.ts`).

### Vercel (producción)

1. **Settings → Environment Variables**.
2. Crea `QZ_PUBLIC_CERT_BASE64`: abre `QZ_PUBLIC_CERT_BASE64.txt` con el Bloc de notas →
   **Ctrl+A** → **Ctrl+C** → pega en *Value*. Entornos: *Production* y *Preview*.
3. Crea `QZ_PRIVATE_KEY_BASE64` igual, con `QZ_PRIVATE_KEY_BASE64.txt`, y márcala como **Sensitive**.
4. **Copia siempre desde el archivo**, nunca desde un chat o un documento: el texto se puede partir o desordenar.
5. **Redeploy obligatorio**: las variables solo aplican a deploys nuevos.
   *Deployments* → el deploy **Current** → **⋯** → **Redeploy** → espera a que diga **Ready**.
6. Si existían `QZ_PUBLIC_CERT` o `QZ_PRIVATE_KEY` (formato anterior), bórralas para evitar confusiones.
   Si están las dos versiones, la app usa la `_BASE64`.

### Local (`.env.local`)

```env
QZ_PUBLIC_CERT_BASE64=<contenido de QZ_PUBLIC_CERT_BASE64.txt>
QZ_PRIVATE_KEY_BASE64=<contenido de QZ_PRIVATE_KEY_BASE64.txt>
```

Sin comillas. Reinicia `npm run dev` después de editarlo.

---

## 4. Verificar la configuración del servidor

Abre en el navegador (o con `curl`):

```
https://www.pidetuantojo.com/api/qz/cert
```

| Respuesta | Significa |
|---|---|
| Texto que empieza con `-----BEGIN CERTIFICATE-----` | ✅ Certificado válido y la clave le corresponde |
| `QZ_PUBLIC_CERT_BASE64 no está configurada` | Falta la variable o no se hizo redeploy |
| `QZ_PUBLIC_CERT_BASE64 no es un certificado válido` | El valor está incompleto o dañado: vuelve a copiarlo del `.txt` |
| `QZ_PRIVATE_KEY_BASE64 no es una clave válida` | La clave está incompleta o dañada |
| `QZ_PRIVATE_KEY_BASE64 no corresponde a QZ_PUBLIC_CERT_BASE64` | Son de pares distintos: genera ambos desde el mismo `.pem` |

La ruta valida todo antes de responder, así que si devuelve el certificado, el servidor está listo.

---

## 5. PC del restaurante (una vez por equipo)

1. Instala **QZ Tray** desde https://qz.io/download.
2. Copia `digital-certificate.pem` a la carpeta de instalación **renombrado como `override.crt`**:
   `C:\Program Files\QZ Tray\override.crt`
3. **Cierra QZ Tray por completo**: clic derecho en el ícono de la bandeja (junto al reloj) → **Exit**.
   > Si lo abres sin cerrarlo antes, la instancia nueva detecta la vieja y se cierra sola:
   > el certificado **no** se carga.
4. Ábrelo de nuevo desde el menú Inicio.
5. En el dashboard: **Mi restaurante → Impresoras**, elige la impresora, **Probar impresión** y **Guardar**.
6. La primera vez aparece un diálogo por cada acción (conectar, ver impresoras, imprimir).
   Debe decir **PideLoNuestro** (no *anonymous*). Marca **Remember this decision** y luego **Allow**.
   Desde ahí imprime sin preguntar.

### Confirmar que QZ Tray cargó el certificado

En `%APPDATA%\qz\debug.log`, al arrancar debe aparecer:

```
Adding CA certificate: CN=PideLoNuestro
```

Y al imprimir:

```
Allowed PideLoNuestro to print to <impresora>      ✅ correcto
Allowed An anonymous request to print to ...        ❌ el certificado del servidor no es válido (ver paso 4)
```

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| *Allow* se deshabilita al marcar *Remember* | QZ trata la solicitud como anónima | Revisa el paso 4; confirma `override.crt` y reinicio con **Exit** (paso 5) |
| "Failed to sign request" / 0 impresoras | `/api/qz/sign` falla (variables faltantes o sin redeploy) | Paso 3 y redeploy; verifica con el paso 4 |
| "QZ Tray no está abierto en este equipo" | QZ Tray no está corriendo | Ábrelo desde el menú Inicio |
| Tocaron *Block* con *Remember* | Quedó bloqueado en `%APPDATA%\qz\blocked.dat` | Borra esa línea del archivo y reinicia QZ Tray |
| Símbolos raros en lugar de tildes | La impresora no soporta CP850 | En **Impresoras**, elige "Sin tildes" |
| Otro usuario de Windows en la misma PC pregunta de nuevo | Los permisos recordados son por usuario | Repite el paso 5.6 con ese usuario |

## Archivos relacionados

- `src/lib/printer/qzServerKey.ts`: lectura de certificado y clave desde variables de entorno.
- `src/app/api/qz/cert/route.ts`: sirve el certificado y valida la configuración.
- `src/app/api/qz/sign/route.ts`: firma las solicitudes (requiere usuario autenticado y activo).
- `src/lib/printer/qzClient.ts`: conexión con QZ Tray desde el navegador.
