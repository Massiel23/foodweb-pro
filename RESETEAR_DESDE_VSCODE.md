# 🔑 RESETEAR CONTRASEÑAS DESDE VISUAL STUDIO CODE

## 📋 PASOS PARA RESETEAR DESDE TU COMPUTADORA

### Paso 1: Obtener DATABASE_URL de Render

1. Ve a: https://dashboard.render.com
2. Click en tu **Web Service** (hotdogs-jzxd)
3. Click en **"Environment"** (menú lateral)
4. Busca la variable **`DATABASE_URL`**
5. Click en el ícono de **"Show"** (ojo) para ver el valor completo
6. **Copia** el valor completo (empieza con `postgresql://`)

### Paso 2: Agregar DATABASE_URL a tu .env local

1. Abre el archivo `.env` en Visual Studio Code
2. Busca la línea que dice `DATABASE_URL=`
3. Reemplázala con el valor que copiaste de Render:

```env
DATABASE_URL=postgresql://usuario:contraseña@host.oregon-postgres.render.com/nombre_db
```

**IMPORTANTE**: Asegúrate de usar la **External Database URL** (no la Internal)

### Paso 3: Ejecutar el Script desde VSCode

Abre la terminal en Visual Studio Code y ejecuta:

```bash
npm run reset-admin
```

### Paso 4: Verificar Output

Deberías ver:
```
🔄 Reseteando contraseña de admin...
✅ Contraseña de admin actualizada a: Admin2026
✅ Contraseña de caja actualizada a: Caja2026

📋 Usuarios en la base de datos:
   - admin (admin)
   - caja (caja)

✅ Proceso completado exitosamente

🔑 Credenciales actualizadas:
   👤 admin / Admin2026
   👤 caja / Caja2026
```

### Paso 5: Probar Login

1. Abre: `https://hotdogs-jzxd.onrender.com`
2. Login con:
   - Usuario: `admin`
   - Contraseña: `Admin2026`
3. ✅ Debería funcionar

---

## 🔍 CÓMO ENCONTRAR LA DATABASE_URL CORRECTA

### En Render Dashboard:

1. **Dashboard** → **PostgreSQL** (tu base de datos)
2. En la página de la base de datos, verás:
   - **Internal Database URL** ❌ (NO uses esta)
   - **External Database URL** ✅ (USA ESTA)

### Formato de la URL:

```
postgresql://usuario:contraseña@host.oregon-postgres.render.com:5432/nombre_db
```

**Ejemplo**:
```
postgresql://hotdogs_user:abc123xyz@dpg-abc123-oregon-postgres.render.com:5432/hotdogs_db
```

---

## ⚠️ ALTERNATIVA: Si no quieres modificar .env

Si prefieres no modificar tu `.env` local, puedes ejecutar el script directamente con la DATABASE_URL:

### En Windows (PowerShell):
```powershell
$env:DATABASE_URL="postgresql://usuario:pass@host/db"; node scripts/reset-admin-password.js
```

### En Windows (CMD):
```cmd
set DATABASE_URL=postgresql://usuario:pass@host/db && node scripts/reset-admin-password.js
```

### En Mac/Linux:
```bash
DATABASE_URL="postgresql://usuario:pass@host/db" node scripts/reset-admin-password.js
```

---

## 🎯 OPCIÓN MÁS FÁCIL: Usar Render Shell

Si prefieres no lidiar con la DATABASE_URL local:

1. Ve a Render Dashboard
2. Click en tu Web Service
3. Click en "Shell"
4. Ejecuta: `npm run reset-admin`

**Ventaja**: No necesitas configurar nada localmente

---

## 📝 RESUMEN

### Opción 1: Desde VSCode (Requiere DATABASE_URL)
```bash
# 1. Agregar DATABASE_URL a .env
# 2. Ejecutar:
npm run reset-admin
```

### Opción 2: Desde Render Shell (Más fácil)
```bash
# En Render Shell:
npm run reset-admin
```

### Opción 3: Comando directo con DATABASE_URL
```bash
# Windows PowerShell:
$env:DATABASE_URL="tu-url-aqui"; node scripts/reset-admin-password.js
```

---

## ✅ DESPUÉS DE RESETEAR

Las credenciales serán:
```
👤 admin / Admin2026
👤 caja / Caja2026
```

Y podrás hacer login en: `https://hotdogs-jzxd.onrender.com`

---

**Recomendación**: Usa **Render Shell** si no quieres modificar tu `.env` local.
