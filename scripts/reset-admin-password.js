require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
    console.log('🔄 Reseteando contraseña de admin...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Hashear nueva contraseña
        const adminHash = await bcrypt.hash('Admin2026', 10);
        const cajaHash = await bcrypt.hash('Caja2026', 10);
        
        // Actualizar admin
        const resultAdmin = await pool.query(
            'UPDATE users SET password = $1 WHERE username = $2',
            [adminHash, 'admin']
        );
        
        if (resultAdmin.rowCount > 0) {
            console.log('✅ Contraseña de admin actualizada a: Admin2026');
        } else {
            console.log('⚠️  Usuario admin no encontrado, creando...');
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', adminHash, 'admin']
            );
            console.log('✅ Usuario admin creado con contraseña: Admin2026');
        }
        
        // Actualizar caja
        const resultCaja = await pool.query(
            'UPDATE users SET password = $1 WHERE username = $2',
            [cajaHash, 'caja']
        );
        
        if (resultCaja.rowCount > 0) {
            console.log('✅ Contraseña de caja actualizada a: Caja2026');
        } else {
            console.log('⚠️  Usuario caja no encontrado, creando...');
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['caja', cajaHash, 'caja']
            );
            console.log('✅ Usuario caja creado con contraseña: Caja2026');
        }
        
        // Verificar usuarios
        const users = await pool.query('SELECT username, role FROM users');
        console.log('\n📋 Usuarios en la base de datos:');
        users.rows.forEach(user => {
            console.log(`   - ${user.username} (${user.role})`);
        });
        
        console.log('\n✅ Proceso completado exitosamente');
        console.log('\n🔑 Credenciales actualizadas:');
        console.log('   👤 admin / Admin2026');
        console.log('   👤 caja / Caja2026');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();
