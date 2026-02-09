# 🔍 DIAGNÓSTICO DE ERROR EN RENDER

## 🐛 ERROR ACTUAL

```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

Esto significa que el servidor está devolviendo HTML en lugar de JSON, indicando que la ruta `/api/auth/login` no está registrada.

---

## 📋 PASOS PARA DIAGNOSTICAR

### PASO 1: Verificar Logs de Render (CRÍTICO)

1. **Ir a Render Dashboard**: https://dashboard.render.com

2. **Click en tu Web Service** (hotdogs-jzxd)

3. **Click en "Logs"** (menú lateral)

4. **Buscar estos mensajes**:

#### ✅ Si ves esto, está bien:
```
🚀 Modo PRODUCCIÓN - Usando PostgreSQL
✅ Tablas creadas
👥 Creando usuarios por defecto...
   ✓ Usuario admin creado (contraseña: Admin2026)
   ✓ Usuario caja creado (contraseña: Caja2026)
✅ Usuarios por defecto creados exitosamente
🚀 Servidor corriendo en puerto 10000
```

#### ❌ Si ves errores, busca:
- `Error: Cannot find module`
- `SyntaxError`
- `TypeError`
- `Error inicializando base de datos`
- `Connection refused`

---

### PASO 2: Verificar Variables de Entorno

1. **En tu Web Service**, click **"Environment"**

2. **Verificar que TODAS estas variables existan**:

```
✅ NODE_ENV = production
✅ DATABASE_URL = postgresql://...
✅ JWT_SECRET = (tu secreto de 512 bits)
✅ JWT_EXPIRES_IN = 8h
✅ BCRYPT_ROUNDS = 10
✅ ALLOWED_ORIGINS = https://hotdogs-jzxd.onrender.com
✅ RATE_LIMIT_WINDOW_MS = 900000
✅ RATE_LIMIT_MAX_REQUESTS = 100
✅ LOGIN_RATE_LIMIT_MAX = 5
```

**Si falta alguna**: Agrégala y haz "Manual Deploy"

---

### PASO 3: Verificar Build Command

1. **En tu Web Service**, click **"Settings"**

2. **Verificar**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Verificar package.json**:
```json
{
  "scripts": {
    "start": "node server-secure.js"
  }
}
```

---

### PASO 4: Verificar que server-secure.js se Desplegó

1. **En Logs**, buscar:
   ```
   Building...
   Installing dependencies...
   Build successful
   Starting service...
   ```

2. **Si el build falló**, buscar el error específico

---

## 🔧 SOLUCIONES SEGÚN EL ERROR

### Error 1: "Cannot find module 'bcrypt'"

**Causa**: Dependencias no instaladas

**Solución**:
1. Ir a Settings
2. Click "Clear build cache & deploy"
3. Esperar a que termine el build

---

### Error 2: "JWT_SECRET is not defined"

**Causa**: Variable de entorno faltante

**Solución**:
1. Ir a Environment
2. Agregar `JWT_SECRET` con tu secreto
3. Save Changes
4. Manual Deploy

---

### Error 3: "Connection refused" o "database does not exist"

**Causa**: DATABASE_URL incorrecta o BD no existe

**Solución**:
1. Ir a tu PostgreSQL en Render
2. Copiar "Internal Database URL"
3. Actualizar DATABASE_URL en Environment
4. Save Changes
5. Manual Deploy

---

### Error 4: "Error inicializando base de datos"

**Causa**: Problema con PostgreSQL

**Solución**:
1. Verificar que PostgreSQL esté "Available" (verde)
2. Verificar DATABASE_URL
3. Si persiste, eliminar y recrear PostgreSQL

---

### Error 5: No hay errores en logs pero sigue sin funcionar

**Causa**: Posiblemente usando server.js en lugar de server-secure.js

**Solución**:
1. Verificar package.json:
   ```json
   "start": "node server-secure.js"
   ```
2. Si dice `"start": "node server.js"`, cambiar a `server-secure.js`
3. Commit y push
4. Esperar redespliegue

---

## 🎯 CHECKLIST DE DIAGNÓSTICO

Marca cada item que verifiques:

- [ ] Logs de Render revisados
- [ ] Variables de entorno verificadas
- [ ] Build Command correcto
- [ ] Start Command correcto
- [ ] package.json usa server-secure.js
- [ ] PostgreSQL está "Available"
- [ ] DATABASE_URL es correcta
- [ ] No hay errores en logs

---

## 📝 INFORMACIÓN A COMPARTIR

Si el problema persiste, comparte:

1. **Últimas 50 líneas de logs de Render**
2. **Variables de entorno** (sin mostrar valores sensibles)
3. **Estado de PostgreSQL** (Available/Unavailable)
4. **Contenido de package.json** (sección scripts)

---

## 🚨 SOLUCIÓN RÁPIDA SI TODO FALLA

Si nada funciona, hacer un "hard reset":

### Opción A: Redeploy Limpio

1. **Settings** → **Clear build cache & deploy**
2. Esperar 5-10 minutos
3. Verificar logs

### Opción B: Recrear Web Service

1. Eliminar Web Service actual
2. Crear nuevo Web Service
3. Conectar repositorio
4. Configurar variables de entorno
5. Desplegar

### Opción C: Verificar Código Local

```bash
# Verificar que server-secure.js existe
ls -la server-secure.js

# Verificar package.json
cat package.json | grep "start"

# Verificar último commit
git log -1

# Verificar que se subió
git status
```

---

## 💡 PREGUNTAS FRECUENTES

### ¿Por qué sigue dando error si ya hice commit?

Posibles razones:
1. Render aún está desplegando (espera 5 min)
2. Build falló (revisar logs)
3. Variables de entorno faltantes
4. PostgreSQL no está listo

### ¿Cómo sé si Render terminó de desplegar?

En Logs verás:
```
Deploy successful
Service is live
```

### ¿Cuánto tarda el despliegue?

- Build: 2-3 minutos
- Start: 1-2 minutos
- Total: 3-5 minutos

---

## 🎯 PRÓXIMO PASO

**Por favor, ve a Render Dashboard y comparte**:

1. **Últimas líneas de los logs** (las más recientes)
2. **Si hay algún error en rojo**
3. **Estado del despliegue** (Building/Live/Failed)

Con esa información podré darte la solución exacta.
