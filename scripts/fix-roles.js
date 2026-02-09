const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigiendo problemas de roles y acceso...\n');

const scriptPath = path.join(__dirname, '..', 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

console.log('📄 Archivo leído\n');

// 1. Corregir función login - cambiar 'user' por 'response.user'
console.log('1️⃣ Corrigiendo función login...');
content = content.replace(
    /const user = await api\.login\(username, password\);[\s\S]*?currentUser = user;/,
    `const response = await api.login(username, password);
        currentUser = response.user;`
);

content = content.replace(
    /if \(user\.role === 'admin'\)/g,
    `if (response.user.role === 'admin')`
);

content = content.replace(
    /else if \(user\.role === 'caja'\)/g,
    `else if (response.user.role === 'caja')`
);

content = content.replace(
    /else if \(user\.role === 'empleado'\)/g,
    `else if (response.user.role === 'empleado')`
);

content = content.replace(
    /if \(user\.role === 'caja'\)/g,
    `if (response.user.role === 'caja')`
);

content = content.replace(
    /showNotification\(`Bienvenido, \$\{user\.username\}!\`\);/,
    `showNotification(\`Bienvenido, \${response.user.username}!\`);`
);

console.log('✅ Función login corregida\n');

// 2. Corregir función logout - agregar api.clearToken()
console.log('2️⃣ Corrigiendo función logout...');
if (!content.includes('api.clearToken()')) {
    content = content.replace(
        /function logout\(\) \{[\s\S]*?currentUser = null;[\s\S]*?localStorage\.removeItem\('currentUser'\);/,
        `function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    api.clearToken();`
    );
    console.log('✅ api.clearToken() agregado a logout\n');
} else {
    console.log('✅ logout ya tiene api.clearToken()\n');
}

// Guardar
fs.writeFileSync(scriptPath, content, 'utf8');

console.log('💾 Archivo guardado\n');
console.log('🎉 ¡Correcciones completadas!\n');
console.log('📝 Cambios aplicados:');
console.log('   1. login() usa response.user correctamente');
console.log('   2. logout() limpia tokens con api.clearToken()');
console.log('   3. Navegación por roles corregida\n');
console.log('🔄 El servidor se reiniciará automáticamente');
console.log('🌐 Refrescar navegador (F5) para probar\n');
