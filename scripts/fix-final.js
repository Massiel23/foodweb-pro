const fs = require('fs');
const path = require('path');

console.log('🔧 Corrección final de script.js...\n');

const scriptPath = path.join(__dirname, '..', 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

console.log('📄 Tamaño original:', content.length, 'caracteres\n');

// Eliminar TODAS las líneas que solo contengan =======
const lines = content.split('\n');
const cleanedLines = lines.filter(line => line.trim() !== '=======');

content = cleanedLines.join('\n');

console.log('✅ Líneas ======= eliminadas');
console.log('📄 Tamaño final:', content.length, 'caracteres\n');

// Guardar
fs.writeFileSync(scriptPath, content, 'utf8');

console.log('💾 Archivo guardado\n');
console.log('🎉 ¡Corrección completada!\n');
console.log('📝 Próximos pasos:');
console.log('   1. Refrescar navegador (F5)');
console.log('   2. Probar el sistema\n');
