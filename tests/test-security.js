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

async function runTests() {
    log('\n🧪 INICIANDO PRUEBAS DE SEGURIDAD - FASE 1\n', colors.blue);
    
    // ========== PRUEBAS DE AUTENTICACIÓN ==========
    log('📋 PRUEBAS DE AUTENTICACIÓN JWT', colors.cyan);
    
    // Test 1: Login exitoso
    try {
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin'
        });
        
        const passed = response.status === 200 && response.data.token && response.data.user;
        logTest('Login con credenciales correctas', passed, 
            passed ? `Token recibido: ${response.data.token.substring(0, 20)}...` : `Status: ${response.status}`);
        
        if (passed) {
            token = response.data.token;
        }
    } catch (error) {
        logTest('Login con credenciales correctas', false, error.message);
    }
    
    // Test 2: Login fallido
    try {
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'admin',
            password: 'wrong'
        });
        
        const passed = response.status === 401;
        logTest('Login con credenciales incorrectas (debe fallar)', passed, 
            `Status: ${response.status}, Error: ${response.data.error}`);
    } catch (error) {
        logTest('Login con credenciales incorrectas', false, error.message);
    }
    
    // Test 3: Login sin datos
    try {
        const response = await makeRequest('POST', '/api/auth/login', {});
        
        const passed = response.status === 400;
        logTest('Login sin datos (debe fallar)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('Login sin datos', false, error.message);
    }
    
    // Test 4: Verificar token
    if (token) {
        try {
            const response = await makeRequest('GET', '/api/auth/verify', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 && response.data.valid;
            logTest('Verificar token válido', passed, 
                `Usuario: ${response.data.user?.username}, Rol: ${response.data.user?.role}`);
        } catch (error) {
            logTest('Verificar token válido', false, error.message);
        }
    }
    
    // Test 5: Acceso sin token
    try {
        const response = await makeRequest('GET', '/api/products');
        
        const passed = response.status === 401;
        logTest('Acceso a ruta protegida sin token (debe fallar)', passed, 
            `Status: ${response.status}`);
    } catch (error) {
        logTest('Acceso sin token', false, error.message);
    }
    
    // Test 6: Acceso con token
    if (token) {
        try {
            const response = await makeRequest('GET', '/api/products', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('Acceso a ruta protegida con token', passed, 
                `Status: ${response.status}, Productos: ${response.data.length}`);
        } catch (error) {
            logTest('Acceso con token', false, error.message);
        }
    }
    
    // ========== PRUEBAS DE VALIDACIÓN ==========
    log('\n📋 PRUEBAS DE VALIDACIÓN DE ENTRADA', colors.cyan);
    
    // Test 7: Crear producto con datos válidos (admin)
    if (token) {
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: 'Hot Dog Test',
                price: 50.00,
                img: '🌭'
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 || response.status === 201;
            logTest('Crear producto con datos válidos', passed, 
                `Status: ${response.status}, ID: ${response.data.id}`);
        } catch (error) {
            logTest('Crear producto válido', false, error.message);
        }
    }
    
    // Test 8: Crear producto con datos inválidos
    if (token) {
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: '',
                price: -10
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 400;
            logTest('Crear producto con datos inválidos (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('Crear producto inválido', false, error.message);
        }
    }
    
    // Test 9: Crear pedido con datos válidos
    if (token) {
        try {
            const response = await makeRequest('POST', '/api/orders', {
                employee: 'admin',
                items: [{ id: 1, name: 'Hot Dog', price: 50, quantity: 1 }],
                total: 50,
                status: 'Pendiente'
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 || response.status === 201;
            logTest('Crear pedido con datos válidos', passed, 
                `Status: ${response.status}, ID: ${response.data.id}`);
        } catch (error) {
            logTest('Crear pedido válido', false, error.message);
        }
    }
    
    // Test 10: Crear pedido con datos inválidos
    if (token) {
        try {
            const response = await makeRequest('POST', '/api/orders', {
                employee: '',
                items: [],
                total: -10
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 400;
            logTest('Crear pedido con datos inválidos (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('Crear pedido inválido', false, error.message);
        }
    }
    
    // ========== PRUEBAS DE AUTORIZACIÓN POR ROLES ==========
    log('\n📋 PRUEBAS DE AUTORIZACIÓN POR ROLES', colors.cyan);
    
    // Test 11: Login como empleado
    let employeeToken = null;
    try {
        const response = await makeRequest('POST', '/api/auth/login', {
            username: 'emple1',
            password: 'emple1'
        });
        
        const passed = response.status === 200 && response.data.token;
        logTest('Login como empleado', passed, 
            `Rol: ${response.data.user?.role}`);
        
        if (passed) {
            employeeToken = response.data.token;
        }
    } catch (error) {
        logTest('Login como empleado', false, error.message);
    }
    
    // Test 12: Empleado intenta crear producto (debe fallar)
    if (employeeToken) {
        try {
            const response = await makeRequest('POST', '/api/products', {
                name: 'Test',
                price: 10
            }, {
                'Authorization': `Bearer ${employeeToken}`
            });
            
            const passed = response.status === 403;
            logTest('Empleado intenta crear producto (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('Empleado crear producto', false, error.message);
        }
    }
    
    // Test 13: Admin puede crear usuarios
    if (token) {
        try {
            const response = await makeRequest('POST', '/api/auth/register', {
                username: 'test_user_' + Date.now(),
                password: 'test123',
                role: 'empleado'
            }, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200 || response.status === 201;
            logTest('Admin puede crear usuarios', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('Admin crear usuarios', false, error.message);
        }
    }
    
    // Test 14: Empleado NO puede crear usuarios
    if (employeeToken) {
        try {
            const response = await makeRequest('POST', '/api/auth/register', {
                username: 'test_fail',
                password: 'test123',
                role: 'empleado'
            }, {
                'Authorization': `Bearer ${employeeToken}`
            });
            
            const passed = response.status === 403;
            logTest('Empleado NO puede crear usuarios (debe fallar)', passed, 
                `Status: ${response.status}`);
        } catch (error) {
            logTest('Empleado crear usuarios', false, error.message);
        }
    }
    
    // ========== PRUEBAS DE RATE LIMITING ==========
    log('\n📋 PRUEBAS DE RATE LIMITING', colors.cyan);
    
    // Test 15: Rate limiting en login (5 intentos)
    log('   Intentando 6 logins fallidos consecutivos...', colors.yellow);
    let rateLimitTriggered = false;
    
    for (let i = 1; i <= 6; i++) {
        try {
            const response = await makeRequest('POST', '/api/auth/login', {
                username: 'test',
                password: 'wrong'
            });
            
            if (i <= 5) {
                log(`   Intento ${i}/6: Status ${response.status}`, colors.cyan);
            } else {
                rateLimitTriggered = response.status === 429;
                log(`   Intento ${i}/6: Status ${response.status} ${rateLimitTriggered ? '(BLOQUEADO ✅)' : '(NO BLOQUEADO ❌)'}`, 
                    rateLimitTriggered ? colors.green : colors.red);
            }
            
            // Pequeña pausa entre intentos
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            log(`   Intento ${i}/6: Error - ${error.message}`, colors.red);
        }
    }
    
    logTest('Rate limiting bloquea después de 5 intentos', rateLimitTriggered, 
        rateLimitTriggered ? 'Sistema bloqueó correctamente en el 6to intento' : 'Sistema NO bloqueó');
    
    // ========== PRUEBAS DE ENDPOINTS PROTEGIDOS ==========
    log('\n📋 PRUEBAS DE ENDPOINTS PROTEGIDOS', colors.cyan);
    
    if (token) {
        // Test 16: GET /api/users (solo admin)
        try {
            const response = await makeRequest('GET', '/api/users', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('GET /api/users (admin)', passed, 
                `Status: ${response.status}, Usuarios: ${response.data.length}`);
        } catch (error) {
            logTest('GET /api/users', false, error.message);
        }
        
        // Test 17: GET /api/orders
        try {
            const response = await makeRequest('GET', '/api/orders', null, {
                'Authorization': `Bearer ${token}`
            });
            
            const passed = response.status === 200;
            logTest('GET /api/orders', passed, 
                `Status: ${response.status}, Pedidos: ${response.data.length}`);
        } catch (error) {
            logTest('GET /api/orders', false, error.message);
        }
    }
    
    // ========== RESUMEN ==========
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 RESUMEN DE PRUEBAS', colors.blue);
    log('='.repeat(60), colors.blue);
    
    const total = testsPassed + testsFailed;
    const percentage = ((testsPassed / total) * 100).toFixed(1);
    
    log(`\n✅ Pruebas exitosas: ${testsPassed}`, colors.green);
    log(`❌ Pruebas fallidas: ${testsFailed}`, colors.red);
    log(`📈 Porcentaje de éxito: ${percentage}%`, percentage >= 90 ? colors.green : colors.yellow);
    log(`📊 Total de pruebas: ${total}\n`, colors.cyan);
    
    if (testsFailed === 0) {
        log('🎉 ¡TODAS LAS PRUEBAS PASARON! Sistema seguro funcionando correctamente.', colors.green);
    } else if (percentage >= 80) {
        log('⚠️  La mayoría de las pruebas pasaron. Revisar las fallidas.', colors.yellow);
    } else {
        log('❌ Varias pruebas fallaron. Se requiere revisión.', colors.red);
    }
    
    log('\n' + '='.repeat(60) + '\n', colors.blue);
    
    process.exit(testsFailed > 0 ? 1 : 0);
}

// Ejecutar pruebas
runTests().catch(err => {
    log(`\n❌ Error fatal: ${err.message}`, colors.red);
    process.exit(1);
});
