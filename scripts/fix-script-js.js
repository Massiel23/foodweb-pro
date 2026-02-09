const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigiendo script.js...\n');

// Leer el archivo original
const scriptPath = path.join(__dirname, '..', 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

console.log('📄 Archivo leído:', scriptPath);
console.log('📏 Tamaño original:', content.length, 'caracteres\n');

// Eliminar marcadores de conflicto de merge
console.log('🧹 Eliminando marcadores de conflicto...');
content = content.replace(/^<<<<<<< SEARCH\n/gm, '');
content = content.replace(/^=======\n/gm, '');
content = content.replace(/^>>>>>>> REPLACE\n/gm, '');

// Verificar si hay marcadores restantes
const hasConflicts = content.includes('<<<<<<<') || content.includes('=======') || content.includes('>>>>>>>');
if (hasConflicts) {
    console.log('⚠️  Advertencia: Aún hay marcadores de conflicto en el archivo');
} else {
    console.log('✅ Marcadores de conflicto eliminados');
}

// Corregir la función showSection
console.log('🔧 Corrigiendo función showSection...');
const oldShowSection = `function showSection(sectionId) {
    const adminSections = ['productos', 'empleados', 'pedidos', 'ajustes', 'facturacion', 'reportes'];
    const cajaSections = ['pendientes-cobrar', 'cobrados', 'tickets'];
    
    if (currentUser.role !== 'admin' && adminSections.includes(sectionId)) {
        alert('Acceso denegado.');
        return;
    }
    
    if (currentUser.role !== 'caja' && currentUser.role !== 'admin' && cajaSections.includes(sectionId)) {
        alert('Acceso denegado.');
        return;
    }`;

const newShowSection = `function showSection(sectionId) {
    const adminSections = ['productos', 'empleados', 'pedidos', 'ajustes', 'facturacion', 'reportes'];
    const cajaSections = ['pendientes-cobrar', 'cobrados', 'tickets'];
    
    // Admin tiene acceso a TODO
    if (currentUser.role === 'admin') {
        // Admin puede acceder a cualquier sección, no hay restricciones
    } else if (currentUser.role === 'caja') {
        // Caja solo puede acceder a secciones de caja y venta
        if (adminSections.includes(sectionId) && sectionId !== 'venta') {
            alert('Acceso denegado.');
            return;
        }
    } else if (currentUser.role === 'empleado') {
        // Empleado no puede acceder a secciones de admin ni caja
        if (adminSections.includes(sectionId) || cajaSections.includes(sectionId)) {
            alert('Acceso denegado.');
            return;
        }
    }`;

if (content.includes(oldShowSection)) {
    content = content.replace(oldShowSection, newShowSection);
    console.log('✅ Función showSection corregida');
} else {
    console.log('⚠️  Función showSection ya estaba corregida o no se encontró');
}

// Corregir la función addToCart
console.log('🔧 Corrigiendo función addToCart...');
const oldAddToCart = `function addToCart(id, name, price) {
    if (currentUser && (currentUser.role === 'empleado' || currentUser.role === 'admin')) {
        showCustomizationModal(id, name, price);
    } else {
        cart.push({ id, name, price: parseFloat(price), customizations: [], quantity: 1, unitPrice: parseFloat(price) });
        total += parseFloat(price);
        updateCart();
        showNotification(\`\${name} agregado al carrito\`);
    }
}`;

const newAddToCart = `function addToCart(id, name, price) {
    // Siempre mostrar ventana de personalización para todos los roles
    showCustomizationModal(id, name, price);
}`;

if (content.includes(oldAddToCart)) {
    content = content.replace(oldAddToCart, newAddToCart);
    console.log('✅ Función addToCart corregida');
} else {
    console.log('⚠️  Función addToCart ya estaba corregida o no se encontró');
}

// Corregir la función login para usar response.user
console.log('🔧 Corrigiendo función login...');
content = content.replace(
    /const user = await api\.login\(username, password\);[\s\n]*currentUser = user;/g,
    'const response = await api.login(username, password);\n        currentUser = response.user;'
);

content = content.replace(/if \(user\.role === 'admin'\)/g, "if (response.user.role === 'admin')");
content = content.replace(/else if \(user\.role === 'caja'\)/g, "else if (response.user.role === 'caja')");
content = content.replace(/else if \(user\.role === 'empleado'\)/g, "else if (response.user.role === 'empleado')");
content = content.replace(/Bienvenido, \$\{user\.username\}/g, 'Bienvenido, ${response.user.username}');

console.log('✅ Función login corregida');

// Corregir la función logout
console.log('🔧 Corrigiendo función logout...');
const oldLogout = `function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    document.getElementById('app').style.display = 'none';`;

const newLogout = `function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    api.clearToken();
    
    document.getElementById('app').style.display = 'none';`;

if (content.includes(oldLogout)) {
    content = content.replace(oldLogout, newLogout);
    console.log('✅ Función logout corregida');
} else {
    console.log('⚠️  Función logout ya estaba corregida o no se encontró');
}

// Guardar el archivo corregido
console.log('\n💾 Guardando archivo corregido...');
fs.writeFileSync(scriptPath, content, 'utf8');

console.log('✅ Archivo guardado exitosamente');
console.log('📏 Tamaño final:', content.length, 'caracteres\n');

// Verificar que no haya errores de sintaxis obvios
const syntaxErrors = [];
if (content.includes('<<<<<<<')) syntaxErrors.push('Marcadores de conflicto <<<<<<< encontrados');
if (content.includes('=======') && !content.includes('// =======')) syntaxErrors.push('Marcadores de conflicto ======= encontrados');
if (content.includes('>>>>>>>')) syntaxErrors.push('Marcadores de conflicto >>>>>>> encontrados');

if (syntaxErrors.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    syntaxErrors.forEach(err => console.log('   -', err));
    console.log('\n❌ El archivo puede tener errores de sintaxis');
    console.log('📖 Consulta FIX_SCRIPT_JS.md para corrección manual\n');
} else {
    console.log('✅ No se detectaron errores de sintaxis obvios');
    console.log('🎉 Corrección completada exitosamente!\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. El servidor se reiniciará automáticamente (nodemon)');
    console.log('   2. Refrescar el navegador (F5)');
    console.log('   3. Probar login como admin');
    console.log('   4. Verificar acceso a todas las secciones');
    console.log('   5. Probar ventana de personalización\n');
}
