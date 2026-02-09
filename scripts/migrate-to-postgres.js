require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

async function migrate() {
    console.log('🔄 Iniciando migración SQLite → PostgreSQL...\n');
    
    // Verificar que DATABASE_URL esté configurado
    if (!process.env.DATABASE_URL) {
        console.error('❌ ERROR: DATABASE_URL no está configurado en .env');
        console.error('💡 Agrega DATABASE_URL a tu archivo .env');
        console.error('   Ejemplo: DATABASE_URL=postgresql://user:pass@host:5432/db\n');
        process.exit(1);
    }
    
    console.log('📍 DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    console.log('');
    
    // Conectar a SQLite
    const sqliteDb = new sqlite3.Database('./pos.db', (err) => {
        if (err) {
            console.error('❌ Error conectando a SQLite:', err.message);
            process.exit(1);
        }
        console.log('✅ Conectado a SQLite (pos.db)');
    });
    
    // Conectar a PostgreSQL
    const pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // Probar conexión a PostgreSQL
        await pgPool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL\n');
        
        // 1. Crear tablas en PostgreSQL
        console.log('📋 Creando tablas en PostgreSQL...');
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                img TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                employee TEXT NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL,
                employee TEXT NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                amount_received REAL DEFAULT 0,
                change_given REAL DEFAULT 0,
                payment_method TEXT DEFAULT 'Efectivo',
                printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
            CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
        `);
        console.log('✅ Tablas e índices creados\n');
        
        // 2. Migrar usuarios
        console.log('👥 Migrando usuarios...');
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        let usersMigrated = 0;
        for (const user of users) {
            try {
                await pgPool.query(
                    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
                    [user.username, user.password, user.role]
                );
                usersMigrated++;
                console.log(`   ✓ ${user.username} (${user.role})`);
            } catch (err) {
                console.error(`   ✗ Error migrando ${user.username}:`, err.message);
            }
        }
        console.log(`✅ ${usersMigrated}/${users.length} usuarios migrados\n`);
        
        // 3. Migrar productos
        console.log('🍔 Migrando productos...');
        const products = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM products', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        let productsMigrated = 0;
        for (const product of products) {
            try {
                await pgPool.query(
                    'INSERT INTO products (name, price, img) VALUES ($1, $2, $3)',
                    [product.name, product.price, product.img]
                );
                productsMigrated++;
                console.log(`   ✓ ${product.name} - $${product.price}`);
            } catch (err) {
                console.error(`   ✗ Error migrando ${product.name}:`, err.message);
            }
        }
        console.log(`✅ ${productsMigrated}/${products.length} productos migrados\n`);
        
        // 4. Migrar pedidos
        console.log('📦 Migrando pedidos...');
        const orders = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM orders', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        let ordersMigrated = 0;
        for (const order of orders) {
            try {
                await pgPool.query(
                    'INSERT INTO orders (employee, items, total, status, created_at) VALUES ($1, $2, $3, $4, $5)',
                    [order.employee, order.items, order.total, order.status, order.created_at]
                );
                ordersMigrated++;
                console.log(`   ✓ Pedido #${order.id} - ${order.employee} - $${order.total}`);
            } catch (err) {
                console.error(`   ✗ Error migrando pedido #${order.id}:`, err.message);
            }
        }
        console.log(`✅ ${ordersMigrated}/${orders.length} pedidos migrados\n`);
        
        // 5. Migrar tickets
        console.log('🎫 Migrando tickets...');
        const tickets = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM tickets', (err, rows) => {
                if (err) {
                    // Si la tabla no existe, continuar
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });
        
        let ticketsMigrated = 0;
        for (const ticket of tickets) {
            try {
                await pgPool.query(
                    'INSERT INTO tickets (order_id, employee, items, total, amount_received, change_given, payment_method, printed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [ticket.order_id, ticket.employee, ticket.items, ticket.total, ticket.amount_received, ticket.change_given, ticket.payment_method, ticket.printed_at]
                );
                ticketsMigrated++;
                console.log(`   ✓ Ticket #${ticket.id} - Pedido #${ticket.order_id}`);
            } catch (err) {
                console.error(`   ✗ Error migrando ticket #${ticket.id}:`, err.message);
            }
        }
        console.log(`✅ ${ticketsMigrated}/${tickets.length} tickets migrados\n`);
        
        // Resumen
        console.log('═══════════════════════════════════════');
        console.log('🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('═══════════════════════════════════════\n');
        console.log('📊 Resumen:');
        console.log(`   - Usuarios: ${usersMigrated}/${users.length}`);
        console.log(`   - Productos: ${productsMigrated}/${products.length}`);
        console.log(`   - Pedidos: ${ordersMigrated}/${orders.length}`);
        console.log(`   - Tickets: ${ticketsMigrated}/${tickets.length}`);
        console.log('');
        console.log('📝 Próximos pasos:');
        console.log('   1. Verificar datos: npm run test:postgres');
        console.log('   2. Hacer backup: cp pos.db pos.db.backup');
        console.log('   3. Reiniciar servidor: npm run dev:secure');
        console.log('   4. Probar login y funcionalidades\n');
        
    } catch (error) {
        console.error('\n❌ Error en migración:', error.message);
        console.error('\n💡 Verifica:');
        console.error('   1. DATABASE_URL está correctamente configurado');
        console.error('   2. PostgreSQL está corriendo');
        console.error('   3. Las credenciales son correctas');
        console.error('   4. La base de datos existe\n');
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
}

migrate();
