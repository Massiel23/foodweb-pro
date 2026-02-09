const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generando JWT_SECRET seguro...\n');

// Generar secreto aleatorio de 64 bytes (512 bits)
const secret = crypto.randomBytes(64).toString('base64');

console.log('✅ JWT_SECRET generado exitosamente:\n');
console.log('━'.repeat(80));
console.log(secret);
console.log('━'.repeat(80));

console.log('\n📋 Longitud:', secret.length, 'caracteres');
console.log('🔒 Nivel de seguridad: 512 bits\n');

// Leer archivo .env actual
const envPath = path.join(__dirname, '..', '.env');
let envContent = '';

try {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Archivo .env encontrado\n');
} catch (error) {
    console.log('⚠️  Archivo .env no encontrado, se creará uno nuevo\n');
}

// Reemplazar o agregar JWT_SECRET
const jwtSecretRegex = /JWT_SECRET=.*/;
if (jwtSecretRegex.test(envContent)) {
    // Reemplazar JWT_SECRET existente
    envContent = envContent.replace(jwtSecretRegex, `JWT_SECRET=${secret}`);
    console.log('✅ JWT_SECRET actualizado en .env\n');
} else {
    // Agregar JWT_SECRET si no existe
    if (!envContent.endsWith('\n')) envContent += '\n';
    envContent += `JWT_SECRET=${secret}\n`;
    console.log('✅ JWT_SECRET agregado a .env\n');
}

// Guardar archivo .env
try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('💾 Archivo .env guardado exitosamente\n');
} catch (error) {
    console.error('❌ Error al guardar .env:', error.message);
    console.log('\n📋 Copia manualmente este secreto a tu archivo .env:\n');
    console.log(`JWT_SECRET=${secret}\n`);
    process.exit(1);
}

// Crear archivo de respaldo con el secreto
const backupPath = path.join(__dirname, '..', '.jwt-secret-backup.txt');
const backupContent = `
JWT_SECRET generado el ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${secret}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  IMPORTANTE:
- Guarda este secreto en un lugar seguro
- NO lo compartas con nadie
- NO lo subas a Git
- Úsalo solo en tu archivo .env

Este archivo se puede eliminar después de verificar que .env está actualizado.
`;

try {
    fs.writeFileSync(backupPath, backupContent, 'utf8');
    console.log('💾 Respaldo guardado en: .jwt-secret-backup.txt\n');
} catch (error) {
    console.log('⚠️  No se pudo crear archivo de respaldo (no es crítico)\n');
}

console.log('🎉 ¡Proceso completado!\n');
console.log('📋 Próximos pasos:');
console.log('   1. Verifica que .env tiene el nuevo JWT_SECRET');
console.log('   2. Reinicia el servidor: npm run dev:secure');
console.log('   3. Los tokens anteriores quedarán inválidos (usuarios deben hacer login nuevamente)');
console.log('   4. Elimina .jwt-secret-backup.txt después de verificar\n');

console.log('⚠️  NOTA: Todos los usuarios deberán iniciar sesión nuevamente\n');
