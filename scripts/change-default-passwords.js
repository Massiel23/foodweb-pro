require('dotenv').config();
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Función para hacer preguntas
function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Función para validar contraseña segura
function isPasswordStrong(password) {
    // Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return {
        valid: minLength && hasUpperCase && hasLowerCase && hasNumber,
        minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumber
    };
}

async function changePasswords() {
    console.log('🔐 CAMBIO DE CONTRASEÑAS POR DEFECTO\n');
    console.log('⚠️  IMPORTANTE: Las contraseñas deben cumplir con:');
    console.log('   - Mínimo 8 caracteres');
    console.log('   - Al menos una letra mayúscula');
    console.log('   - Al menos una letra minúscula');
    console.log('   - Al menos un número');
    console.log('   - Recomendado: Incluir caracteres especiales (!@#$%^&*)\n');
    
    const db = new sqlite3.Database('./pos.db');
    
    try {
        // Obtener usuarios actuales
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, role FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Usuarios encontrados: ${users.length}\n`);
        
        for (const user of users) {
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`👤 Usuario: ${user.username} (${user.role})`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            const change = await question(`¿Cambiar contraseña de "${user.username}"? (s/n): `);
            
            if (change.toLowerCase() !== 's') {
                console.log(`⏭️  Saltando ${user.username}\n`);
                continue;
            }
            
            let newPassword = '';
            let confirmPassword = '';
            let passwordValid = false;
            
            while (!passwordValid) {
                newPassword = await question(`Nueva contraseña para ${user.username}: `);
                
                // Validar fortaleza
                const strength = isPasswordStrong(newPassword);
                
                if (!strength.valid) {
                    console.log('\n❌ Contraseña débil. Problemas encontrados:');
                    if (!strength.minLength) console.log('   - Debe tener al menos 8 caracteres');
                    if (!strength.hasUpperCase) console.log('   - Debe tener al menos una letra mayúscula');
                    if (!strength.hasLowerCase) console.log('   - Debe tener al menos una letra minúscula');
                    if (!strength.hasNumber) console.log('   - Debe tener al menos un número');
                    console.log('\nIntenta nuevamente:\n');
                    continue;
                }
                
                confirmPassword = await question('Confirmar contraseña: ');
                
                if (newPassword !== confirmPassword) {
                    console.log('\n❌ Las contraseñas no coinciden. Intenta nuevamente.\n');
                    continue;
                }
                
                passwordValid = true;
            }
            
            // Hashear contraseña
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
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
            
            console.log(`✅ Contraseña de "${user.username}" actualizada exitosamente\n`);
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 ¡Todas las contraseñas han sido actualizadas!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📋 RESUMEN:');
        console.log(`   - Usuarios actualizados: ${users.length}`);
        console.log(`   - Base de datos: pos.db`);
        console.log(`   - Hash: bcrypt (10 rounds)\n`);
        
        console.log('⚠️  IMPORTANTE:');
        console.log('   - Guarda las nuevas contraseñas en un lugar seguro');
        console.log('   - Comparte las credenciales de forma segura con los usuarios');
        console.log('   - Considera usar un gestor de contraseñas\n');
        
        console.log('🔄 Próximos pasos:');
        console.log('   1. Reinicia el servidor: npm run dev:secure');
        console.log('   2. Prueba el login con las nuevas contraseñas');
        console.log('   3. Informa a los usuarios sobre el cambio\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.close();
        rl.close();
    }
}

// Ejecutar
changePasswords();
