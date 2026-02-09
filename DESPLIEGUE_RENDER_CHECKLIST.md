# ✅ CHECKLIST PARA DESPLIEGUE EN RENDER

## ❓ TU PREGUNTA

**"Si hago el commit así como está, ¿se va a desplegar en Render y funcionarán los usuarios ya agregados?"**

---

## 🎯 RESPUESTA RÁPIDA

**SÍ, PERO** necesitas hacer algunos ajustes en Render para que funcione correctamente:

### ✅ Lo que SÍ funcionará automáticamente:
1. El código se desplegará sin errores
2. El servidor iniciará correctamente
3. La estructura de seguridad está lista

### ⚠️ Lo que NECESITAS configurar en Render:
1. **Variables de entorno** (JWT_SECRET, DATABASE_URL, etc.)
2. **Base de datos PostgreSQL** en Render
3. **Migrar usuarios** a PostgreSQL (las contraseñas con bcrypt)

---

## 📋 CHECKLIST ANTES DE HACER COMMIT

### 1. ✅ Verificar que .gitignore está correcto

```bash
# Verificar que .env NO se subirá a Git
cat .gitignore | grep .env
```

**Debe contener**:
```
.env
.env.local
.env.*.local
*.log
logs/
pos.db
*.sqlite
*.sqlite3
node_modules/
```

### 2. ✅ Verificar que .env.example existe

Este archivo SÍ se sube a Git y sirve de plantilla:

```env
# .env.example
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=change-this-to-a-random-secret-512-bits
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
ALLOWED_ORIGINS=https://tu-app.onrender.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### 3. ✅ Decidir qué servidor usar

Tienes 2 opciones:

**Opción A: server.js (Original - Sin seguridad completa)**
```json
// package.json
"scripts": {
  "start": "node server.js"
}
```

**Opción B: server-secure.js (Recomendado - Con seguridad)**
```json
// package.json
"scripts": {
  "start": "node server-secure.js"
}
```

**RECOMENDACIÓN**: Cambiar a `server-secure.js` para producción

---

## 🚀 PASOS PARA DESPLEGAR EN RENDER

### PASO 1: Preparar el Código

#### A. Actualizar package.json para usar server-secure.js

```json
{
  "scripts": {
    "start": "node server-secure.js",
    "dev": "nodemon server-secure.js"
  }
}
```

#### B. Verificar que .env.example existe

```bash
# Crear .env.example si no existe
cat > .env.example << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=change-this-to-a-random-secret
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
ALLOWED_ORIGINS=https://tu-app.onrender.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
EOF
```

#### C. Hacer commit

```bash
git add .
git commit -m "feat: Implementar seguridad completa con JWT y bcrypt"
git push origin main
```

---

### PASO 2: Configurar PostgreSQL en Render

1. **Ir a Render Dashboard**: https://dashboard.render.com
2. **Crear PostgreSQL**:
   - Click "New +" → "PostgreSQL"
   - Name: `hotdogs-pos-db`
   - Database: `hotdogs_pos`
   - User: (se genera automáticamente)
   - Region: Oregon (US West)
   - Plan: Free
   - Click "Create Database"

3. **Copiar DATABASE_URL**:
   - En la página de la base de datos
   - Buscar "Connections"
   - Copiar **Internal Database URL**
   - Se verá así:
   ```
   postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos
   ```

---

### PASO 3: Configurar Variables de Entorno en Render

1. **Ir a tu Web Service** en Render
2. **Click en "Environment"**
3. **Agregar estas variables**:

```
NODE_ENV = production
DATABASE_URL = postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos
JWT_SECRET = (copiar de tu .env local - el de 512 bits)
JWT_EXPIRES_IN = 8h
BCRYPT_ROUNDS = 10
ALLOWED_ORIGINS = https://tu-app.onrender.com
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX_REQUESTS = 100
LOGIN_RATE_LIMIT_MAX = 5
```

4. **Click "Save Changes"**

---

### PASO 4: Migrar Usuarios a PostgreSQL

**IMPORTANTE**: Los usuarios en SQLite (pos.db) NO se transferirán automáticamente a PostgreSQL en Render.

#### Opción A: Crear usuarios manualmente en producción

Después del despliegue, usar la API para crear usuarios:

```bash
# Crear usuario admin
curl -X POST https://tu-app.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DE_ADMIN" \
  -d '{
    "username": "admin",
    "password": "Admin2026",
    "role": "admin"
  }'

# Crear usuario caja
curl -X POST https://tu-app.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_DE_ADMIN" \
  -d '{
    "username": "caja",
    "password": "Caja2026",
    "role": "caja"
  }'
```

#### Opción B: Migrar desde local a Render PostgreSQL

```bash
# 1. Actualizar .env local con DATABASE_URL de Render
DATABASE_URL=postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos

# 2. Ejecutar migración
npm run migrate:postgres

# 3. Restaurar .env local
# DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos
```

#### Opción C: Usar script de inicialización en server-secure.js

El código actual ya tiene esto:

```javascript
// En server-secure.js, líneas ~50-60
pool.query(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin') ON CONFLICT (username) DO NOTHING`);
pool.query(`INSERT INTO users (username, password, role) VALUES ('caja', 'caja', 'caja') ON CONFLICT (username) DO NOTHING`);
```

**PROBLEMA**: Estas contraseñas están en texto plano ('admin', 'caja')

**SOLUCIÓN**: Actualizar server-secure.js para usar contraseñas hasheadas

---

## ⚠️ PROBLEMA CRÍTICO IDENTIFICADO

### El código actual tiene contraseñas por defecto en texto plano

En `server-secure.js` (líneas ~50-60):

```javascript
// ❌ PROBLEMA: Contraseñas en texto plano
pool.query(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin') ON CONFLICT (username) DO NOTHING`);
pool.query(`INSERT INTO users (username, password, role) VALUES ('caja', 'caja', 'caja') ON CONFLICT (username) DO NOTHING`);
```

### SOLUCIÓN NECESARIA

Necesitas actualizar `server-secure.js` para crear usuarios con contraseñas hasheadas:

```javascript
// ✅ SOLUCIÓN: Usar bcrypt para hashear contraseñas por defecto
const bcrypt = require('bcrypt');

// Después de crear tablas
const adminPassword = await bcrypt.hash('Admin2026', 10);
const cajaPassword = await bcrypt.hash('Caja2026', 10);

await pool.query(
    `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING`,
    ['admin', adminPassword, 'admin']
);
await pool.query(
    `INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING`,
    ['caja', cajaPassword, 'caja']
);
```

---

## 🔧 CORRECCIÓN NECESARIA ANTES DE DESPLEGAR

### Actualizar server-secure.js

Necesito actualizar el código de inicialización de usuarios en `server-secure.js` para que use bcrypt.

**¿Quieres que haga esta corrección ahora?**

---

## 📝 RESUMEN

### ✅ Lo que está listo:
1. Código de seguridad implementado
2. JWT y bcrypt configurados
3. Validadores y rate limiting
4. Scripts de migración creados
5. Documentación completa

### ⚠️ Lo que NECESITAS hacer antes de desplegar:

1. **CRÍTICO**: Actualizar server-secure.js para usar contraseñas hasheadas
2. Crear PostgreSQL en Render
3. Configurar variables de entorno en Render
4. Cambiar script de inicio a `server-secure.js`
5. Hacer commit y push

### 🎯 Usuarios después del despliegue:

**Si NO corriges server-secure.js**:
- ❌ admin / admin (texto plano - NO funcionará con bcrypt)
- ❌ caja / caja (texto plano - NO funcionará con bcrypt)

**Si corriges server-secure.js**:
- ✅ admin / Admin2026 (hasheado con bcrypt)
- ✅ caja / Caja2026 (hasheado con bcrypt)

---

## ❓ SIGUIENTE PASO

**¿Quieres que actualice server-secure.js para que los usuarios por defecto usen contraseñas hasheadas con bcrypt?**

Esto es NECESARIO para que funcione correctamente en Render.

**Opciones**:
A) **SÍ** - Actualiza server-secure.js ahora (RECOMENDADO)
B) **NO** - Crearé los usuarios manualmente después del despliegue
C) **EXPLICAR MÁS** - Necesito más detalles sobre cómo funciona

---

## 💡 RECOMENDACIÓN

**ANTES de hacer commit**, déjame actualizar `server-secure.js` para que:
1. Use contraseñas hasheadas con bcrypt
2. Cree usuarios admin y caja automáticamente
3. Funcione correctamente en Render desde el primer despliegue

Esto te ahorrará problemas y configuración manual después del despliegue.
