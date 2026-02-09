# 🔧 SOLUCIÓN RÁPIDA - Configurar .env

## Problema Detectado

El servidor está detectando modo PRODUCCIÓN porque el archivo `.env` tiene configurado `DATABASE_URL`.

## Solución (2 minutos)

### Opción 1: Editar .env manualmente

Abre el archivo `.env` y **comenta o elimina** la línea de DATABASE_URL:

```env
# Entorno
NODE_ENV=development
PORT=3000

# Base de datos (COMENTAR ESTA LÍNEA PARA DESARROLLO)
# DATABASE_URL=postgresql://user:password@localhost:5432/hotdogs_pos

# Seguridad
JWT_SECRET=tu-secreto-jwt-super-seguro-de-al-menos-64-caracteres-aleatorios-cambiar-en-produccion
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.101.53:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### Opción 2: Usar el archivo .env correcto

O simplemente copia este contenido completo al archivo `.env`:

```env
# Entorno
NODE_ENV=development
PORT=3000

# Seguridad
JWT_SECRET=tu-secreto-jwt-super-seguro-de-al-menos-64-caracteres-aleatorios-cambiar-en-produccion
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.101.53:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

## Después de Editar

1. Guarda el archivo `.env`
2. Ejecuta: `npm run dev:secure`
3. Deberías ver: "💻 Modo DESARROLLO - Usando SQLite"

## Verificación

Si ves este mensaje, está correcto:
```
💻 Modo DESARROLLO - Usando SQLite
🚀 Servidor corriendo en puerto 3000
📱 Entorno: development
```

Si ves este mensaje, DATABASE_URL sigue configurado:
```
🚀 Modo PRODUCCIÓN - Usando PostgreSQL  ❌ INCORRECTO
