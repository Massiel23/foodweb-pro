# 🔑 RESETEAR CONTRASEÑAS EN RENDER

## 🎯 PROBLEMA

El login devuelve **401 Unauthorized** con el mensaje "Credenciales inválidas".

Esto significa que:
- ✅ El servidor está funcionando
- ✅ Las rutas están operativas
- ✅ La API responde correctamente
- ⚠️ Las contraseñas en la base de datos no coinciden con las esperadas

---

## ✅ SOLUCIÓN: Resetear Contraseñas desde Render Shell

### OPCIÓN 1: Usar Render Shell (RECOMENDADO)

#### Paso 1: Abrir Shell en Render

1. Ve a: https://dashboard.render.com
2. Click en tu **Web Service** (hotdogs-jzxd)
3. Click en **"Shell"** (menú lateral)
4. Espera a que se abra la terminal

#### Paso 2: Ejecutar Script de Reset

En la terminal de Render, ejecuta:

```bash
npm run reset-admin
```

#### Paso 3: Verificar Output

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

#### Paso 4: Probar Login

1. Abre: `https://hotdogs-jzxd.onrender.com`
2. Login con:
   - Usuario: `admin`
   - Contraseña: `Admin2026`
3. ✅ Debería funcionar

---

### OPCIÓN 2: Commit y Push (Alternativa)

Si prefieres hacerlo desde tu computadora:

#### Paso 1: Commit y Push

```bash
git add .
git commit -m "feat: Agregar script para resetear contraseñas"
git push origin main
```

#### Paso 2: Esperar Redespliegue

Render redesplegará automáticamente (3-5 minutos)

#### Paso 3: Abrir Shell y Ejecutar

Una vez desplegado:
1. Abrir Shell en Render
2. Ejecutar: `npm run reset-admin`

---

## 🔍 VERIFICAR USUARIOS ACTUALES

Si quieres ver qué usuarios existen en la base de datos:

### En Render Shell:

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT id, username, role FROM users').then(r => {
  console.log('Usuarios:', r.rows);
  pool.end();
});
"
```

---

## 🔐 CONTRASEÑAS FINALES

Después de ejecutar el script:

```
👤 ADMIN
Usuario: admin
Contraseña: Admin2026
Rol: admin

👤 CAJA
Usuario: caja
Contraseña: Caja2026
Rol: caja
```

---

## ⚠️ IMPORTANTE

### ¿Por qué las contraseñas no coincidían?

Posibles razones:
1. Los usuarios ya existían con contraseñas diferentes
2. Se crearon manualmente con otras contraseñas
3. El script de inicialización no se ejecutó correctamente

### Solución Permanente

El script `reset-admin-password.js`:
- ✅ Actualiza las contraseñas si los usuarios existen
- ✅ Crea los usuarios si no existen
- ✅ Usa bcrypt para hashear las contraseñas
- ✅ Verifica que todo esté correcto

---

## 🚀 PASOS RÁPIDOS

1. **Abrir Shell en Render** (Dashboard → Web Service → Shell)
2. **Ejecutar**: `npm run reset-admin`
3. **Esperar** confirmación
4. **Probar login** con `admin` / `Admin2026`

**Tiempo total**: 2 minutos ⏱️

---

## 📝 SCRIPT CREADO

El script está en: `scripts/reset-admin-password.js`

Puedes ejecutarlo:
- **En Render**: `npm run reset-admin`
- **Localmente**: `npm run reset-admin` (necesitas DATABASE_URL en .env)

---

## ✅ DESPUÉS DE RESETEAR

Una vez que ejecutes el script:

1. ✅ Las contraseñas estarán actualizadas
2. ✅ Podrás hacer login con `admin` / `Admin2026`
3. ✅ El sistema estará 100% operativo
4. ✅ Todas las funcionalidades disponibles

---

**¡Ejecuta el script y el login funcionará!** 🎉
