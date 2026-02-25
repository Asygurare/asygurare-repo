# Google Sign-In: guía paso a paso

Esta guía explica cómo dejar funcionando el login y registro con Google en tu app (el código ya está implementado; solo falta la configuración en Google y Supabase).

---

## Resumen de lo que ya está en el código

- **Login** (`/login`): botón "Continuar con Google" que redirige a Google y luego a `/api/auth/callback` → `/dashboard`.
- **Signup** (`/signup`): mismo botón para registrarse con Google.
- **Callback** (`/api/auth/callback`): recibe el código de Google, lo intercambia por sesión en Supabase y redirige al usuario.
- **Middleware**: la ruta `/api/auth` es pública para que el callback funcione sin estar logueado.

---

## Paso 1: Crear credenciales en Google Cloud

### 1.1 Entrar a la consola

1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Inicia sesión con la cuenta de Google que uses para desarrollo.

### 1.2 Crear o elegir un proyecto

1. Arriba a la izquierda, abre el selector de proyectos.
2. Si quieres, crea uno nuevo: **"Nuevo proyecto"** → nombre (ej. "Asygurare") → **Crear**.
3. Selecciona ese proyecto.

### 1.3 Configurar la pantalla de consentimiento OAuth

1. Menú **☰** → **APIs y servicios** → **Pantalla de consentimiento de OAuth**.
2. Si te pregunta el tipo de usuario, elige **Externo** (para que cualquier cuenta de Google pueda iniciar sesión).
3. Rellena:
   - **Nombre de la aplicación**: p. ej. "Asygurare"
   - **Correo de asistencia**: tu email
   - **Dominios autorizados** (opcional): tu dominio en producción, ej. `asygurare.com`
4. **Guardar y continuar** hasta terminar (no hace falta añadir scopes sensibles).

### 1.4 Crear el cliente OAuth 2.0

1. Menú **☰** → **APIs y servicios** → **Credenciales**.
2. **+ Crear credenciales** → **ID de cliente de OAuth**.
3. **Tipo de aplicación**: **Aplicación web**.
4. **Nombre**: p. ej. "Asygurare Web".
5. **Orígenes de JavaScript autorizados** (añade todos los que uses):
   - Desarrollo: `http://localhost:3000` (o el puerto que uses, ej. `http://127.0.0.1:3000`)
   - Producción: `https://tudominio.com`
6. **URI de redirección autorizados**:
   - Aquí va la URL de **Supabase**, no la de tu app.
   - Formato: `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
   - Ejemplo: `https://abcdefghijk.supabase.co/auth/v1/callback`
   - La encuentras en Supabase en **Authentication → URL Configuration** (o en la doc del provider Google) como "Callback URL (for OAuth)".
7. **Crear**.
8. Copia el **ID de cliente** y el **Secreto de cliente** (lo necesitas en el Paso 2).

---

## Paso 2: Configurar Google en Supabase

### 2.1 Abrir el proyecto en Supabase

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard).
2. Abre tu proyecto (Asygurare o el que sea).

### 2.2 Obtener la URL de callback de Supabase

1. En el menú izquierdo: **Authentication** → **Providers** (o **URL Configuration**).
2. Busca la **Callback URL** que Supabase usa para OAuth. Será algo como:
   - `https://<ref>.supabase.co/auth/v1/callback`
3. Esa misma URL es la que debes haber puesto en **URI de redirección autorizados** en Google (Paso 1.4).

### 2.3 Activar el proveedor Google

1. **Authentication** → **Providers**.
2. Busca **Google** y actívalo (toggle en **Enable**).
3. Pega:
   - **Client ID**: el que copiaste de Google.
   - **Client Secret**: el secreto de cliente de Google.
4. **Save**.

### 2.4 Redirect URLs permitidas en Supabase

1. **Authentication** → **URL Configuration** (o **Redirect URLs**).
2. En **Redirect URLs** añade **ambas** (desarrollo y producción) para poder probar en local y en producción:
   - **Desarrollo:** `http://localhost:3000/api/auth/callback` (o `http://127.0.0.1:3000/api/auth/callback` si usas ese puerto).
   - **Producción:** `https://tudominio.com/api/auth/callback`.
3. **Site URL** suele ser la URL principal de tu app (ej. `https://tudominio.com` o `http://localhost:3000` en desarrollo).

---

## Paso 3: Probar en local

1. Arranca la app:
   ```bash
   npm run dev
   ```
2. Abre `http://localhost:3000/login` (o el puerto que uses).
3. Haz clic en **"Continuar con Google"**.
4. Deberías ir a Google, elegir cuenta y volver a tu app en `/dashboard`.

Si algo falla:

- **Redirect URI mismatch**: la URL de redirección en Google debe ser exactamente la de Supabase (`https://...supabase.co/auth/v1/callback`), no la de tu app.
- **Redirect URL not allowed**: en Supabase, en Redirect URLs, debe estar `http://localhost:3000/api/auth/callback` (con el puerto correcto).
- **Error en login**: revisa la consola del navegador y los logs de Supabase (Authentication → Logs).

---

## Paso 4: Ponerlo en producción

1. **Google Cloud Console**:
   - En el mismo cliente OAuth (o en uno solo para producción), añade en **Orígenes autorizados**: `https://tudominio.com`.
   - En **URI de redirección**: la de Supabase sigue siendo la misma (`https://...supabase.co/auth/v1/callback`); no cambia por entorno.

2. **Supabase**:
   - En **Redirect URLs** añade: `https://tudominio.com/api/auth/callback`.
   - **Site URL** en producción suele ser `https://tudominio.com`.

3. Despliega tu app y prueba de nuevo el botón "Continuar con Google" en `/login` y `/signup`.

---

## Flujo técnico (referencia)

1. Usuario hace clic en **"Continuar con Google"** en `/login` o `/signup`.
2. La app llama a `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/api/auth/callback?next=/dashboard' } })`.
3. Supabase redirige al usuario a Google.
4. El usuario se autentica en Google y Google redirige a **Supabase** (`.../auth/v1/callback`) con un código.
5. Supabase redirige a **tu app** a `https://tudominio.com/api/auth/callback?code=...&next=/dashboard`.
6. La ruta `GET /api/auth/callback` (en `src/app/api/auth/callback/route.ts`) recibe el `code`, llama a `exchangeCodeForSession(code)` y guarda la sesión en cookies.
7. Se redirige al usuario a `next` (por defecto `/dashboard`).

---

## Usuarios que solo se registran con Google

Si tienes un trigger o función que crea una fila en `profiles` usando `raw_user_meta_data` del signup por email (p. ej. `first_name`, `last_name`, `agency_name`), con Google esos campos pueden no existir; Supabase suele enviar `full_name`, `email`, `avatar_url`. Si quieres que los usuarios que solo usan Google también tengan perfil, hay que adaptar ese trigger para derivar nombre (y opcionalmente avatar) desde `full_name` / `avatar_url` cuando falten `first_name` / `last_name`.
