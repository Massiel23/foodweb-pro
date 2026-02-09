# 🐘 GUÍA: CONFIGURAR POSTGRESQL PARA HOT DOGS POS

## 📋 OPCIONES DE CONFIGURACIÓN

Tienes 3 opciones para configurar PostgreSQL:

### Opción A: PostgreSQL Local (Desarrollo)
### Opción B: PostgreSQL en Render (Producción)
### Opción C: PostgreSQL en Otro Servicio (Neon, Supabase, etc.)

---

## 🔧 OPCIÓN A: POSTGRESQL LOCAL (DESARROLLO)

### Paso 1: Instalar PostgreSQL

#### Windows
1. Descargar desde: https://www.postgresql.org/download/windows/
2. Ejecutar instalador
3. Durante instalación:
   - Puerto: `5432` (por defecto)
   - Usuario: `postgres`
   - Contraseña: (elige una segura, ej: `postgres123`)

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Paso 2: Crear Base de Datos

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE hotdogs_pos;

# Crear usuario (opcional)
CREATE USER hotdogs_user WITH PASSWORD 'tu_contraseña_segura';

# Dar permisos
GRANT ALL PRIVILEGES ON DATABASE hotdogs_pos TO hotdogs_user;

# Salir
\q
```

### Paso 3: Actualizar .env

```env
# .env
NODE_ENV=development
PORT=3000

# PostgreSQL Local
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos

# O si creaste un usuario específico:
# DATABASE_URL=postgresql://hotdogs_user:tu_contraseña_segura@localhost:5432/hotdogs_pos

# Seguridad
JWT_SECRET=tu-secreto-jwt-actual-no-cambiar
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.101.53:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### Paso 4: Verificar Conexión

```bash
# Probar conexión
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/hotdogs_pos' }); pool.query('SELECT NOW()', (err, res) => { console.log(err ? err : res.rows[0]); pool.end(); });"
```

---

## ☁️ OPCIÓN B: POSTGRESQL EN RENDER (PRODUCCIÓN)

### Paso 1: Crear Base de Datos en Render

1. Ir a https://dashboard.render.com
2. Click en "New +" → "PostgreSQL"
3. Configurar:
   - **Name**: `hotdogs-pos-db`
   - **Database**: `hotdogs_pos`
   - **User**: (se genera automáticamente)
   - **Region**: Oregon (US West) o el más cercano
   - **Plan**: Free (o el que prefieras)
4. Click "Create Database"

### Paso 2: Obtener DATABASE_URL

1. En el dashboard de la base de datos, buscar "Connections"
2. Copiar el **Internal Database URL** (más rápido) o **External Database URL**
3. Se verá así:
```
postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos
```

### Paso 3: Actualizar .env para Producción

```env
# .env (PRODUCCIÓN)
NODE_ENV=production
PORT=3000

# PostgreSQL en Render
DATABASE_URL=postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos

# Seguridad
JWT_SECRET=tu-secreto-jwt-actual-no-cambiar
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS (agregar tu dominio de Render)
ALLOWED_ORIGINS=https://tu-app.onrender.com,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### Paso 4: Configurar Variables de Entorno en Render

1. Ir a tu Web Service en Render
2. Click en "Environment"
3. Agregar variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (pegar la URL de PostgreSQL)
   - `JWT_SECRET` = (tu secreto actual)
   - `JWT_EXPIRES_IN` = `8h`
   - `BCRYPT_ROUNDS` = `10`
   - `ALLOWED_ORIGINS` = `https://tu-app.onrender.com`
4. Click "Save Changes"

### Paso 5: Migrar Datos (Opcional)

Si ya tienes datos en SQLite y quieres migrarlos a PostgreSQL:

```bash
# Exportar datos de SQLite
sqlite3 pos.db .dump > backup.sql

# Convertir a PostgreSQL (manual o con herramienta)
# Luego importar a PostgreSQL
psql -U postgres -d hotdogs_pos -f backup_postgres.sql
```

---

## 🌐 OPCIÓN C: OTROS SERVICIOS

### Neon (Recomendado - Serverless PostgreSQL)

1. Ir a https://neon.tech
2. Crear cuenta gratuita
3. Crear proyecto "hotdogs-pos"
4. Copiar Connection String
5. Actualizar .env:

```env
DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/hotdogs_pos?sslmode=require
```

### Supabase (PostgreSQL + Extras)

1. Ir a https://supabase.com
2. Crear proyecto "hotdogs-pos"
3. En Settings → Database → Connection String
4. Copiar "URI" (no "Connection pooling")
5. Actualizar .env:

```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

### Railway

1. Ir a https://railway.app
2. New Project → Provision PostgreSQL
3. Copiar DATABASE_URL de variables
4. Actualizar .env

---

## 🔄 MIGRACIÓN DE SQLITE A POSTGRESQL

### Script Automático de Migración

```javascript
// scripts/migrate-to-postgres.js
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

async function migrate() {
    console.log('🔄 Iniciando migración SQLite → PostgreSQL...\n');
    
    // Conectar a SQLite
    const sqliteDb = new sqlite3.Database('./pos.db');
    
    // Conectar a PostgreSQL
    const pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // 1. Crear tablas en PostgreSQL
        console.log('📋 Creando tablas en PostgreSQL...');
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT
            );
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT,
                price REAL,
                img TEXT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                employee TEXT,
                items TEXT,
                total REAL,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                order_id INTEGER,
                employee TEXT,
                items TEXT,
                total REAL,
                amount_received REAL,
                change_given REAL,
                payment_method TEXT DEFAULT 'Efectivo',
                printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tablas creadas\n');
        
        // 2. Migrar usuarios
        console.log('👥 Migrando usuarios...');
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const user of users) {
            await pgPool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
                [user.username, user.password, user.role]
            );
        }
        console.log(`✅ ${users.length} usuarios migrados\n`);
        
        // 3. Migrar productos
        console.log('🍔 Migrando productos...');
        const products = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM products', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const product of products) {
            await pgPool.query(
                'INSERT INTO products (name, price, img) VALUES ($1, $2, $3)',
                [product.name, product.price, product.img]
            );
        }
        console.log(`✅ ${products.length} productos migrados\n`);
        
        // 4. Migrar pedidos
        console.log('📦 Migrando pedidos...');
        const orders = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM orders', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const order of orders) {
            await pgPool.query(
                'INSERT INTO orders (employee, items, total, status, created_at) VALUES ($1, $2, $3, $4, $5)',
                [order.employee, order.items, order.total, order.status, order.created_at]
            );
        }
        console.log(`✅ ${orders.length} pedidos migrados\n`);
        
        // 5. Migrar tickets
        console.log('🎫 Migrando tickets...');
        const tickets = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        for (const ticket of tickets) {
            await pgPool.query(
                'INSERT INTO tickets (order_id, employee, items, total, amount_received, change_given, payment_method, printed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [ticket.order_id, ticket.employee, ticket.items, ticket.total, ticket.amount_received, ticket.change_given, ticket.payment_method, ticket.printed_at]
            );
        }
        console.log(`✅ ${tickets.length} tickets migrados\n`);
        
        console.log('🎉 ¡Migración completada exitosamente!\n');
        console.log('📝 Próximos pasos:');
        console.log('   1. Verificar datos en PostgreSQL');
        console.log('   2. Hacer backup de pos.db');
        console.log('   3. Actualizar NODE_ENV=production en .env');
        console.log('   4. Reiniciar servidor\n');
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
}

migrate();
```

### Ejecutar Migración

```bash
# Asegúrate de tener DATABASE_URL configurado en .env
node scripts/migrate-to-postgres.js
```

---

## 🔍 VERIFICAR CONFIGURACIÓN

### Script de Verificación

```javascript
// scripts/test-postgres.js
require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('🧪 Probando conexión a PostgreSQL...\n');
    console.log('📍 DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // Probar conexión
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa!');
        console.log('🕐 Hora del servidor:', result.rows[0].now);
        
        // Verificar tablas
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('\n📋 Tablas encontradas:');
        tables.rows.forEach(row => {
            console.log('   -', row.table_name);
        });
        
        // Contar registros
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const productCount = await pool.query('SELECT COUNT(*) FROM products');
        const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
        
        console.log('\n📊 Registros:');
        console.log('   - Usuarios:', userCount.rows[0].count);
        console.log('   - Productos:', productCount.rows[0].count);
        console.log('   - Pedidos:', orderCount.rows[0].count);
        
        console.log('\n🎉 ¡Todo funciona correctamente!\n');
        
    } catch (error) {
        console.error('\n❌ Error de conexión:', error.message);
        console.error('\n💡 Verifica:');
        console.error('   1. DATABASE_URL está correctamente configurado en .env');
        console.error('   2. PostgreSQL está corriendo');
        console.error('   3. Las credenciales son correctas');
        console.error('   4. El puerto 5432 está abierto\n');
    } finally {
        await pool.end();
    }
}

testConnection();
```

### Ejecutar Verificación

```bash
node scripts/test-postgres.js
```

---

## 📝 FORMATO DE DATABASE_URL

### Estructura General
```
postgresql://[usuario]:[contraseña]@[host]:[puerto]/[base_de_datos]?[opciones]
```

### Ejemplos

#### Local
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos
```

#### Render
```env
DATABASE_URL=postgresql://hotdogs_pos_user:contraseña@dpg-xxxxx.oregon-postgres.render.com/hotdogs_pos
```

#### Neon
```env
DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/hotdogs_pos?sslmode=require
```

#### Supabase
```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

---

## 🚀 ACTUALIZAR package.json

Agregar scripts útiles:

```json
{
  "scripts": {
    "start": "node server.js",
    "start:secure": "node server-secure.js",
    "dev": "nodemon server.js",
    "dev:secure": "nodemon server-secure.js",
    "migrate:postgres": "node scripts/migrate-to-postgres.js",
    "test:postgres": "node scripts/test-postgres.js",
    "reset-db": "node reset-db.js",
    "test": "node test-api.js"
  }
}
```

---

## ⚙️ CONFIGURACIÓN ACTUAL vs PRODUCCIÓN

### Desarrollo (SQLite)
```env
# .env
NODE_ENV=development
# DATABASE_URL no configurado = usa SQLite
```

### Producción (PostgreSQL)
```env
# .env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## 🔄 CAMBIAR DE SQLITE A POSTGRESQL

### Paso 1: Backup de SQLite
```bash
cp pos.db pos.db.backup
```

### Paso 2: Configurar DATABASE_URL en .env
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/hotdogs_pos
```

### Paso 3: Migrar Datos (Opcional)
```bash
npm run migrate:postgres
```

### Paso 4: Verificar
```bash
npm run test:postgres
```

### Paso 5: Reiniciar Servidor
```bash
# El servidor se reiniciará automáticamente con nodemon
# O manualmente:
npm run dev:secure
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "password authentication failed"
```bash
# Verificar contraseña
psql -U postgres -d hotdogs_pos
# Si falla, resetear contraseña de PostgreSQL
```

### Error: "database does not exist"
```bash
# Crear base de datos
createdb hotdogs_pos
# O con psql:
psql -U postgres -c "CREATE DATABASE hotdogs_pos;"
```

### Error: "connection refused"
```bash
# Verificar que PostgreSQL está corriendo
# Windows:
services.msc # Buscar "postgresql"

# macOS:
brew services list

# Linux:
sudo systemctl status postgresql
```

### Error: "SSL required"
```javascript
// Agregar SSL en conexión
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
```

---

## ✅ CHECKLIST DE CONFIGURACIÓN

### Antes de Configurar
- [ ] Hacer backup de pos.db
- [ ] Tener PostgreSQL instalado (local) o cuenta en servicio cloud
- [ ] Tener DATABASE_URL listo

### Durante Configuración
- [ ] Actualizar .env con DATABASE_URL
- [ ] Verificar conexión con test-postgres.js
- [ ] Migrar datos si es necesario
- [ ] Probar login y funcionalidades

### Después de Configurar
- [ ] Verificar que todas las funciones trabajan
- [ ] Hacer backup de PostgreSQL
- [ ] Documentar credenciales en lugar seguro
- [ ] Actualizar .env.example (sin credenciales reales)

---

## 📞 COMANDOS ÚTILES

```bash
# Conectar a PostgreSQL
psql -U postgres -d hotdogs_pos

# Ver tablas
\dt

# Ver datos de una tabla
SELECT * FROM users;

# Contar registros
SELECT COUNT(*) FROM orders;

# Backup de PostgreSQL
pg_dump -U postgres hotdogs_pos > backup.sql

# Restaurar backup
psql -U postgres -d hotdogs_pos < backup.sql

# Salir de psql
\q
```

---

## 🎯 RECOMENDACIÓN

Para **desarrollo local**, usa **PostgreSQL local** (Opción A)
Para **producción**, usa **Render PostgreSQL** (Opción B) o **Neon** (Opción C)

**Ventajas de PostgreSQL sobre SQLite**:
- ✅ Mejor rendimiento con múltiples usuarios
- ✅ Transacciones más robustas
- ✅ Funciones avanzadas (JSON, full-text search)
- ✅ Escalabilidad
- ✅ Backups automáticos (en servicios cloud)

---

## 📝 PRÓXIMOS PASOS

1. **Elegir opción** (A, B o C)
2. **Configurar DATABASE_URL** en .env
3. **Verificar conexión** con test-postgres.js
4. **Migrar datos** (opcional) con migrate-to-postgres.js
5. **Reiniciar servidor** y probar

---

**¿Necesitas ayuda con algún paso específico?** 🤔

Puedo ayudarte a:
- Instalar PostgreSQL local
- Configurar Render PostgreSQL
- Crear el script de migración
- Solucionar errores de conexión
