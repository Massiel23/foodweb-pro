const fs = require('fs');
const path = require('path');

console.log('🔧 Eliminando marcadores de conflicto de merge...\n');

const scriptPath = path.join(__dirname, '..', 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

console.log('📄 Archivo leído');
console.log('📏 Tamaño: ', content.length, 'caracteres\n');

// Contar marcadores antes
const beforeCount = {
    search: (content.match(/<<<<<<< SEARCH/g) || []).length,
    equals: (content.match(/^=======/gm) || []).length,
    replace: (content.match(/>>>>>>> REPLACE/g) || []).length
};

console.log('📊 Marcadores encontrados:');
console.log('   <<<<<<< SEARCH:', beforeCount.search);
console.log('   =======:', beforeCount.equals);
console.log('   >>>>>>> REPLACE:', beforeCount.replace);
console.log('');

// Eliminar TODOS los marcadores de conflicto
console.log('🧹 Eliminando marcadores...');

// Eliminar líneas completas que contengan marcadores
content = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed !== '<<<<<<< SEARCH' && 
           trimmed !== '=======' && 
           trimmed !== '>>>>>>> REPLACE';
}).join('\n');

// Verificar resultado
const afterCount = {
    search: (content.match(/<<<<<<< SEARCH/g) || []).length,
    equals: (content.match(/^=======/gm) || []).length,
    replace: (content.match(/>>>>>>> REPLACE/g) || []).length
};

console.log('📊 Marcadores después de limpieza:');
console.log('   <<<<<<< SEARCH:', afterCount.search);
console.log('   =======:', afterCount.equals);
console.log('   >>>>>>> REPLACE:', afterCount.replace);
console.log('');

// Guardar
fs.writeFileSync(scriptPath, content, 'utf8');

console.log('✅ Archivo guardado');
console.log('📏 Tamaño final:', content.length, 'caracteres\n');

if (afterCount.search === 0 && afterCount.equals === 0 && afterCount.replace === 0) {
    console.log('🎉 ¡Todos los marcadores eliminados exitosamente!');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. El servidor se reiniciará automáticamente');
    console.log('   2. Refrescar el navegador (F5)');
    console.log('   3. Probar el sistema\n');
} else {
    console.log('⚠️  Aún quedan marcadores. Puede ser necesario editar manualmente.\n');
}
