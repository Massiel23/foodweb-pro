require('dotenv').config();
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function migratePasswords() {
    const dbPath = path.join(__dirname, '..', 'pos.db');
    const db = new sqlite3.Database(dbPath);
    
    console.log('🔄 Iniciando migración de contraseñas...');
    console.log('📁 Base de datos:', dbPath);
    
    // Obtener todos los usuarios
    db.all('SELECT * FROM users', async (err, users) => {
        if (err) {
            console.error('❌ Error al obtener usuarios:', err);
            db.close();
            return;
        }
        
        if (!users || users.length === 0) {
            console.log('⚠️  No se encontraron usuarios en la base de datos');
            db.close();
            return;
        }
        
        console.log(`📊 Encontrados ${users.length} usuarios`);
        
        let migrated = 0;
        let skipped = 0;
        let errors = 0;
        
        for (const user of users) {
            // Verificar si la contraseña ya está hasheada (bcrypt hash empieza con $2b$)
            if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
                console.log(`⏭️  ${user.username} - Ya tiene contraseña hasheada`);
                skipped++;
                continue;
            }
            
            try {
                // Hashear contraseña
                const hashedPassword = await bcrypt.hash(user.password, parseInt(process.env.BCRYPT_ROUNDS) || 10);
                
                // Actualizar en base de datos
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE users SET password = ? WHERE id = ?',
                        [hashedPassword, user.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                
                console.log(`✅ ${user.username} - Contraseña migrada exitosamente`);
                migrated++;
            } catch (error) {
                console.error(`❌ Error migrando ${user.username}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n📊 Resumen de migración:');
        console.log(`   ✅ Migradas: ${migrated}`);
        console.log(`   ⏭️  Omitidas: ${skipped}`);
        console.log(`   ❌ Errores: ${errors}`);
        console.log('\n✅ Migración completada');
        
        db.close();
    });
}

// Ejecutar migración
migratePasswords().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
