adminrequire('dotenv').config();
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Función para generar contraseña segura
function generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Completar el resto
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mezclar caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function resetPasswords() {
    console.log('🔐 GENERACIÓN AUTOMÁTICA DE CONTRASEÑAS SEGURAS\n');
    console.log('⚠️  Este script generará contraseñas aleatorias seguras para todos los usuarios\n');
    
    const db = new sqlite3.Database('./pos.db');
    const newCredentials = [];
    
    try {
        // Obtener usuarios actuales
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username, role FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Usuarios encontrados: ${users.length}\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        for (const user of users) {
            // Generar contraseña segura
            const newPassword = generateSecurePassword(16);
            
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
            
            // Guardar credenciales
            newCredentials.push({
                username: user.username,
                password: newPassword,
                role: user.role
            });
            
            console.log(`✅ ${user.username} (${user.role}) - Contraseña actualizada`);
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 ¡Todas las contraseñas han sido actualizadas!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📋 NUEVAS CREDENCIALES:\n');
        console.log('┌─────────────────────────────────────────────────────────────────────────┐');
        
        newCredentials.forEach(cred => {
            console.log(`│ Usuario: ${cred.username.padEnd(15)} │ Rol: ${cred.role.padEnd(10)} │`);
            console.log(`│ Contraseña: ${cred.password.padEnd(45)} │`);
            console.log('├─────────────────────────────────────────────────────────────────────────┤');
        });
        
        console.log('└─────────────────────────────────────────────────────────────────────────┘\n');
        
        // Guardar en archivo
        const fs = require('fs');
        const credentialsFile = '.new-credentials.txt';
        let fileContent = `
NUEVAS CREDENCIALES - Generadas el ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
        
        newCredentials.forEach(cred => {
            fileContent += `Usuario: ${cred.username}\n`;
            fileContent += `Contraseña: ${cred.password}\n`;
            fileContent += `Rol: ${cred.role}\n`;
            fileContent += `\n`;
        });
        
        fileContent += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANTE:
- Guarda estas credenciales en un lugar seguro
- Compártelas de forma segura con los usuarios correspondientes
- Elimina este archivo después de guardar las credenciales
- Considera usar un gestor de contraseñas

Este archivo se puede eliminar después de copiar las credenciales.
`;
        
        fs.writeFileSync(credentialsFile, fileContent, 'utf8');
        console.log(`💾 Credenciales guardadas en: ${credentialsFile}\n`);
        
        console.log('⚠️  IMPORTANTE:');
        console.log('   - Guarda las credenciales en un lugar seguro');
        console.log('   - Comparte las credenciales de forma segura');
        console.log('   - Elimina .new-credentials.txt después de copiarlas');
        console.log('   - Considera usar un gestor de contraseñas\n');
        
        console.log('🔄 Próximos pasos:');
        console.log('   1. Copia las credenciales a un lugar seguro');
        console.log('   2. Elimina .new-credentials.txt');
        console.log('   3. Reinicia el servidor: npm run dev:secure');
        console.log('   4. Prueba el login con las nuevas contraseñas');
        console.log('   5. Comparte las credenciales con los usuarios\n');
        
        console.log('📊 RESUMEN:');
        console.log(`   - Usuarios actualizados: ${users.length}`);
        console.log(`   - Longitud de contraseñas: 16 caracteres`);
        console.log(`   - Nivel de seguridad: Alto (mayúsculas, minúsculas, números, especiales)`);
        console.log(`   - Hash: bcrypt (10 rounds)\n`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.close();
    }
}

// Ejecutar
resetPasswords();
