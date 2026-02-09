const http = require('http');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

let testsPassed = 0;
let testsFailed = 0;
let token = null;

function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
    if (passed) {
        testsPassed++;
        log(`✅ ${name}`, colors.green);
        if (details) log(`   ${details}`, colors.cyan);
    } else {
        testsFailed++;
        log(`❌ ${name}`, colors.red);
        if (details) log(`   ${details}`, colors.yellow);
    }
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    log('\n🧪 PRUEBAS COMPLETAS DE SEGURIDAD - FASE 1\n', colors.blue);
    log('⏱️  Nota: Estas pruebas incluyen pausas para evitar rate limiting\n', colors.yellow);
    
    // ========== PRUEBAS DE AUTENTICACIÓN ==========
    log('📋 SECCIÓN 1: AUTENTICACIÓN JWT', colors.cyan);
    
    // Test 1: Login exitoso
    try {
        await wait(1000); // Pausa de 1 segundo
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        
        const passed = response.status === 200 && response.data.token && response.data.user;
        logTest('1. Login con credenciales correctas', passed, 
            passed ? `Token: ${response.data.token.substring(0, 30)}..., Usuario: ${response.data.user.username}, Rol: ${response.data.user.role}` : `Status: ${response.status}, Error: ${response.data.error}`);
        
        if (passed) {
            token = response.data.token;
        }
    } catch (error) {
        logTest('1. Login con credenciales correctas', false, error.message);
    }
    
    // Test 2: Login fallido
    try {
        await wait(1000);
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'wrong_password'
        });
        
        const passed = response.status === 401;
        logTest('2. Login con contraseña incorrecta (debe fallar)', passed, 
            `Status: ${response.status}, Mensaje: ${response.data.error || 'Sin mensaje'}`);
    } catch (error) {
        logTest('2. Login con contraseña incorrecta', false, error.message);
    }
    
    // Test 3: Login con usuario inexistente
    try {
        await wait(1000);
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'usuario_no_existe',
            password: 'cualquier_cosa'
        });
        
        const passed = response.status === 401;
        logTest('3. Login con usuario inexistente (debe fallar)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('3. Login con usuario inexistente', false, error.message);
    }
    
    // Test 4: Login sin datos
    try {
        await wait(1000);
        const response = await makeRequest('POST', '/api/auth/login', {});
        
        const passed = response.status === 400;
        logTest('4. Login sin datos (debe fallar por validación)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('4. Login sin datos', false, error.message);
    }
    
    // Test 5: Verificar token
    if (token) {
        try {
            const response = await makeRequest('GET', '/api/auth/verify', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 && response.data.valid;
            logTest('5. Verificar token válido', passed, 
                `Usuario: ${response.data.user?.username}, Rol: ${response.data.user?.role}`);
        } catch (error) {
            logTest('5. Verificar token válido', false, error.message);
        }
    }
    
    // Test 6: Token inválido
    try {
        const response = await makeRequest('GET', '/api/auth/verify', null, {
            'Authorization': 'Bearer token_invalido_123'
        });
        
        const passed = response.status === 403;
        logTest('6. Token inválido (debe fallar)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('6. Token inválido', false, error.message);
    }
    
    // Test 7: Sin token
    try {
        const response = await makeRequest('GET', '/api/products');
        
        const passed = response.status === 401;
        logTest('7. Acceso sin token (debe fallar)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('7. Acceso sin token', false, error.message);
    }
    
    // ========== PRUEBAS DE ENDPOINTS PROTEGIDOS ==========
    log('\n📋 SECCIÓN 2: ENDPOINTS PROTEGIDOS', colors.cyan);
    
    if (token) {
        // Test 8: GET /api/products
        try {
            const response = await makeRequest('GET', '/api/products', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('8. GET /api/products con token', passed, 
                `Status: ${response.status}, Productos: ${Array.isArray(response.data) ? response.data.length : 0}`);
        } catch (error) {
            logTest('8. GET /api/products', false, error.message);
        }
        
        // Test 9: GET /api/orders
        try {
            const response = await makeRequest('GET', '/api/orders', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('9. GET /api/orders con token', passed, 
                `Status: ${response.status}, Pedidos: ${Array.isArray(response.data) ? response.data.length : 0}`);
        } catch (error) {
            logTest('9. GET /api/orders', false, error.message);
        }
        
        // Test 10: GET /api/users (solo admin)
        try {
            const response = await makeRequest('GET', '/api/users', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('10. GET /api/users (admin)', passed, 
                `Status: ${response.status}, Usuarios: ${Array.isArray(response.data) ? response.data.length : 0}`);
        } catch (error) {
            logTest('10. GET /api/users', false, error.message);
        }
    }
    
    // ========== PRUEBAS DE VALIDACIÓN ==========
    log('\n📋 SECCIÓN 3: VALIDACIÓN DE ENTRADA', colors.cyan);
    
    if (token) {
        // Test 11: Crear producto válido
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: 'Hot Dog Test Seguridad',
                price: 55.50,
                img: '🌭'
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 || response.status === 201;
            logTest('11. Crear producto con datos válidos', passed, 
                `Status: ${response.status}, ID: ${response.data.id}`);
        } catch (error) {
            logTest('11. Crear producto válido', false, error.message);
        }
        
        // Test 12: Crear producto inválido (precio negativo)
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: 'Producto Inválido',
                price: -10
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 400;
            logTest('12. Crear producto con precio negativo (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('12. Crear producto inválido', false, error.message);
        }
        
        // Test 13: Crear producto sin nombre
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: '',
                price: 50
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 400;
            logTest('13. Crear producto sin nombre (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('13. Crear producto sin nombre', false, error.message);
        }
    }
    
    // ========== PRUEBAS DE AUTORIZACIÓN POR ROLES ==========
    log('\n📋 SECCIÓN 4: AUTORIZACIÓN POR ROLES', colors.cyan);
    
    // Test 14: Login como empleado
    let employeeToken = null;
    try {
        await wait(2000); // Pausa más larga antes de cambiar de usuario
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'emple1',
            password: 'emple1'
        });
        
        const passed = response.status === 200 && response.data.token && response.data.user.role === 'empleado';
        logTest('14. Login como empleado', passed, 
            `Usuario: ${response.data.user?.username}, Rol: ${response.data.user?.role}`);
        
        if (passed) {
            employeeToken = response.data.token;
        }
    } catch (error) {
        logTest('14. Login como empleado', false, error.message);
    }
    
    // Test 15: Empleado NO puede crear productos
    if (employeeToken) {
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: 'Test Empleado',
                price: 10
            }, {
                'Authorization': `Bearer ${employeeToken}`
            });
            
            const passed = response.status === 403;
            logTest('15. Empleado NO puede crear productos (debe fallar)', passed, 
                `Status: ${response.status}, Mensaje: ${response.data.error || 'Sin mensaje'}`);
        } catch (error) {
            logTest('15. Empleado crear productos', false, error.message);
        }
        
        // Test 16: Empleado NO puede ver usuarios
        try {
            const response = await makeRequest('GET', '/api/users', null, {
                'Authorization': `Bearer ${employeeToken}`
            });
            
            const passed = response.status === 403;
            logTest('16. Empleado NO puede ver usuarios (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('16. Empleado ver usuarios', false, error.message);
        }
        
        // Test 17: Empleado SÍ puede ver productos
        try {
            const response = await makeRequest('GET', '/api/products', null, {
                'Authorization': `Bearer ${employeeToken}`
            });
            
            const passed = response.status === 200;
            logTest('17. Empleado SÍ puede ver productos', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('17. Empleado ver productos', false, error.message);
        }
    }
    
    // ========== RESUMEN ==========
    log('\n' + '='.repeat(70), colors.blue);
    log('📊 RESUMEN FINAL DE PRUEBAS DE SEGURIDAD', colors.blue);
    log('='.repeat(70), colors.blue);
    
    const total = testsPassed + testsFailed;
    const percentage = ((testsPassed / total) * 100).toFixed(1);
    
    log(`\n✅ Pruebas exitosas: ${testsPassed}/${total}`, colors.green);
    log(`❌ Pruebas fallidas: ${testsFailed}/${total}`, testsFailed > 0 ? colors.red : colors.green);
    log(`📈 Porcentaje de éxito: ${percentage}%`, percentage >= 90 ? colors.green : percentage >= 70 ? colors.yellow : colors.red);
    
    log('\n📋 DESGLOSE POR SECCIÓN:', colors.cyan);
    log('   • Autenticación JWT: 7 pruebas', colors.cyan);
    log('   • Endpoints Protegidos: 3 pruebas', colors.cyan);
    log('   • Validación de Entrada: 3 pruebas', colors.cyan);
    log('   • Autorización por Roles: 4 pruebas', colors.cyan);
    log(`   • TOTAL: ${total} pruebas\n`, colors.cyan);
    
    if (testsFailed === 0) {
        log('🎉 ¡PERFECTO! TODAS LAS PRUEBAS PASARON', colors.green);
        log('✅ El sistema de seguridad está funcionando correctamente', colors.green);
        log('✅ Fase 1 (Seguridad) COMPLETADA exitosamente\n', colors.green);
    } else if (percentage >= 90) {
        log('✅ ¡EXCELENTE! Más del 90% de las pruebas pasaron', colors.green);
        log(`⚠️  Revisar ${testsFailed} prueba(s) fallida(s)\n`, colors.yellow);
    } else if (percentage >= 70) {
        log('⚠️  ACEPTABLE. La mayoría de las pruebas pasaron', colors.yellow);
        log(`❌ Revisar ${testsFailed} prueba(s) fallida(s)\n`, colors.yellow);
    } else {
        log('❌ ATENCIÓN. Varias pruebas fallaron', colors.red);
        log(`❌ Se requiere revisión de ${testsFailed} prueba(s)\n`, colors.red);
    }
    
    log('='.repeat(70) + '\n', colors.blue);
    
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Ejecutar pruebas
log('\n⏳ Iniciando suite de pruebas de seguridad...', colors.yellow);
log('   Esto tomará aproximadamente 30 segundos\n', colors.yellow);

runTests().catch(err => {
    log(`\n❌ Error fatal: ${err.message}`, colors.red);
    console.error(err);
    process.exit(1);
});
