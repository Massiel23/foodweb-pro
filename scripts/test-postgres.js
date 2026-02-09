require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('🧪 Probando conexión a PostgreSQL...\n');
    
    // Verificar que DATABASE_URL esté configurado
    if (!process.env.DATABASE_URL) {
        console.error('❌ ERROR: DATABASE_URL no está configurado en .env');
        console.error('💡 Agrega DATABASE_URL a tu archivo .env');
        console.error('   Ejemplo: DATABASE_URL=postgresql://user:pass@host:5432/db\n');
        process.exit(1);
    }
    
    // Mostrar URL (ocultando contraseña)
    const safeUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log('📍 DATABASE_URL:', safeUrl);
    console.log('🌍 Entorno:', process.env.NODE_ENV || 'development');
    console.log('');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // 1. Probar conexión básica
        console.log('1️⃣ Probando conexión básica...');
        const result = await pool.query('SELECT NOW(), version()');
        console.log('✅ Conexión exitosa!');
        console.log('🕐 Hora del servidor:', result.rows[0].now);
        console.log('📦 Versión PostgreSQL:', result.rows[0].version.split(' ')[1]);
        console.log('');
        
        // 2. Verificar tablas
        console.log('2️⃣ Verificando tablas...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        if (tables.rows.length === 0) {
            console.log('⚠️  No hay tablas creadas');
            console.log('💡 Las tablas se crearán automáticamente al iniciar el servidor\n');
        } else {
            console.log('📋 Tablas encontradas:');
            tables.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });
            console.log('');
            
            // 3. Contar registros
            console.log('3️⃣ Contando registros...');
            
            try {
                const userCount = await pool.query('SELECT COUNT(*) FROM users');
                console.log(`   👥 Usuarios: ${userCount.rows[0].count}`);
            } catch (e) {
                console.log('   👥 Usuarios: tabla no existe');
            }
            
            try {
                const productCount = await pool.query('SELECT COUNT(*) FROM products');
                console.log(`   🍔 Productos: ${productCount.rows[0].count}`);
            } catch (e) {
                console.log('   🍔 Productos: tabla no existe');
            }
            
            try {
                const orderCount = await pool.query('SELECT COUNT(*) FROM orders');
                console.log(`   📦 Pedidos: ${orderCount.rows[0].count}`);
            } catch (e) {
                console.log('   📦 Pedidos: tabla no existe');
            }
            
            try {
                const ticketCount = await pool.query('SELECT COUNT(*) FROM tickets');
                console.log(`   🎫 Tickets: ${ticketCount.rows[0].count}`);
            } catch (e) {
                console.log('   🎫 Tickets: tabla no existe');
            }
            console.log('');
            
            // 4. Mostrar usuarios
            try {
                const users = await pool.query('SELECT username, role FROM users ORDER BY id');
                if (users.rows.length > 0) {
                    console.log('4️⃣ Usuarios en la base de datos:');
                    users.rows.forEach(user => {
                        console.log(`   👤 ${user.username} (${user.role})`);
                    });
                    console.log('');
                }
            } catch (e) {
                // Tabla no existe aún
            }
        }
        
        // 5. Verificar permisos
        console.log('5️⃣ Verificando permisos...');
        try {
            await pool.query('CREATE TEMP TABLE test_permissions (id SERIAL)');
            await pool.query('DROP TABLE test_permissions');
            console.log('✅ Permisos de escritura: OK');
        } catch (e) {
            console.error('❌ Error de permisos:', e.message);
        }
        console.log('');
        
        // Resumen final
        console.log('═══════════════════════════════════════');
        console.log('🎉 ¡CONEXIÓN A POSTGRESQL EXITOSA!');
        console.log('═══════════════════════════════════════\n');
        console.log('✅ Todo funciona correctamente');
        console.log('');
        console.log('📝 Próximos pasos:');
        console.log('   1. Si no hay datos, migrar: npm run migrate:postgres');
        console.log('   2. Iniciar servidor: npm run dev:secure');
        console.log('   3. Probar login en http://localhost:3000\n');
        
    } catch (error) {
        console.error('\n❌ Error de conexión:', error.message);
        console.error('\n💡 Posibles causas:');
        console.error('   1. DATABASE_URL incorrecto en .env');
        console.error('   2. PostgreSQL no está corriendo');
        console.error('   3. Credenciales incorrectas');
        console.error('   4. Base de datos no existe');
        console.error('   5. Firewall bloqueando puerto 5432');
        console.error('');
        console.error('🔧 Soluciones:');
        console.error('   - Verificar DATABASE_URL en .env');
        console.error('   - Crear base de datos: createdb hotdogs_pos');
        console.error('   - Verificar PostgreSQL: psql -U postgres -l');
        console.error('');
    } finally {
        sqliteDb.close();
        await pool.end();
    }
}

testConnection();
