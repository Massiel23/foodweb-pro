# ⚡ INICIO RÁPIDO - CONFIGURAR POSTGRESQL

## 🎯 OPCIÓN MÁS RÁPIDA: PostgreSQL Local

### 1️⃣ Instalar PostgreSQL (5 minutos)

#### Windows
```bash
# Descargar e instalar desde:
https://www.postgresql.org/download/windows/

# Durante instalación:
# - Puerto: 5432
# - Usuario: postgres
# - Contraseña: postgres123 (o la que prefieras)
```

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Linux
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2️⃣ Crear Base de Datos (1 minuto)

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE hotdogs_pos;

# Salir
\q
```

### 3️⃣ Actualizar .env (30 segundos)

Agregar esta línea a tu archivo `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos
```

**IMPORTANTE**: Cambia `postgres123` por la contraseña que elegiste durante la instalación.

### 4️⃣ Verificar Conexión (30 segundos)

```bash
npm run test:postgres
```

**Resultado esperado**:
```
🧪 Probando conexión a PostgreSQL...
✅ Conexión exitosa!
🎉 ¡CONEXIÓN A POSTGRESQL EXITOSA!
```

### 5️⃣ Migrar Datos (Opcional - 1 minuto)

Si ya tienes datos en SQLite:

```bash
npm run migrate:postgres
```

### 6️⃣ Reiniciar Servidor (automático)

El servidor se reiniciará automáticamente con nodemon y ahora usará PostgreSQL.

---

## 🚀 COMANDOS DISPONIBLES

```bash
# Verificar conexión a PostgreSQL
npm run test:postgres

# Migrar datos de SQLite a PostgreSQL
npm run migrate:postgres

# Iniciar servidor (usa PostgreSQL si DATABASE_URL está configurado)
npm run dev:secure
```

---

## ✅ VERIFICACIÓN RÁPIDA

### ¿Cómo saber si está usando PostgreSQL?

Al iniciar el servidor, verás:

```
🚀 Modo PRODUCCIÓN - Usando PostgreSQL  ← PostgreSQL
```

O:

```
💻 Modo DESARROLLO - Usando SQLite      ← SQLite
```

### Cambiar entre SQLite y PostgreSQL

**Usar PostgreSQL**:
```env
# .env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos
```

**Usar SQLite**:
```env
# .env
# DATABASE_URL=postgresql://... (comentar o eliminar)
```

---

## 🐛 SOLUCIÓN RÁPIDA DE PROBLEMAS

### Error: "password authentication failed"
```bash
# La contraseña en DATABASE_URL es incorrecta
# Verifica la contraseña que usaste al instalar PostgreSQL
```

### Error: "database does not exist"
```bash
# Crear la base de datos
createdb hotdogs_pos

# O con psql:
psql -U postgres -c "CREATE DATABASE hotdogs_pos;"
```

### Error: "connection refused"
```bash
# PostgreSQL no está corriendo
# Windows: Iniciar servicio en services.msc
# macOS: brew services start postgresql@15
# Linux: sudo systemctl start postgresql
```

---

## 📝 EJEMPLO COMPLETO DE .env

```env
# Entorno
NODE_ENV=development
PORT=3000

# Base de Datos PostgreSQL
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos

# Seguridad
JWT_SECRET=tu-secreto-jwt-actual-de-512-bits-no-cambiar
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.101.53:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

---

## 🎯 RESUMEN

1. **Instalar PostgreSQL** (5 min)
2. **Crear base de datos** `hotdogs_pos` (1 min)
3. **Agregar DATABASE_URL** a .env (30 seg)
4. **Verificar**: `npm run test:postgres` (30 seg)
5. **Migrar datos** (opcional): `npm run migrate:postgres` (1 min)
6. **Listo!** El servidor usará PostgreSQL automáticamente

**Tiempo total: ~7 minutos** ⚡

---

## 📖 DOCUMENTACIÓN COMPLETA

Para más detalles, ver: **CONFIGURAR_POSTGRESQL.md**

Incluye:
- Configuración para Render (producción)
- Configuración para Neon, Supabase, Railway
- Scripts de migración completos
- Solución de problemas detallada
- Comandos útiles de PostgreSQL

---

**¿Necesitas ayuda con algún paso?** 🤔
