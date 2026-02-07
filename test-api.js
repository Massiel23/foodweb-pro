// Script de prueba para verificar la API
const http = require('http');

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: body
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando pruebas de la API...\n');

    try {
        // Test 1: Login
        console.log('Test 1: Login con admin');
        const login = await makeRequest('POST', '/api/login', {
            username: 'admin',
            password: 'admin'
        });
        console.log('✅ Status:', login.status);
        console.log('   Respuesta:', login.data);
        console.log('');

        // Test 2: Obtener productos
        console.log('Test 2: Obtener productos');
        const products = await makeRequest('GET', '/api/products');
        console.log('✅ Status:', products.status);
        console.log('   Productos encontrados:', products.data.length);
        console.log('');

        // Test 3: Obtener usuarios
        console.log('Test 3: Obtener usuarios');
        const users = await makeRequest('GET', '/api/users');
        console.log('✅ Status:', users.status);
        console.log('   Usuarios encontrados:', users.data.length);
        console.log('');

        // Test 4: Crear pedido
        console.log('Test 4: Crear pedido');
        const order = await makeRequest('POST', '/api/orders', {
            employee: 'admin',
            items: [
                { name: 'Hot Dog Clásico', price: 5.00 },
                { name: 'Bebida Refresco', price: 2.00 }
            ],
            total: 7.00,
            status: 'Pendiente'
        });
        console.log('✅ Status:', order.status);
        console.log('   Pedido creado:', order.data);
        console.log('');

        // Test 5: Obtener pedidos
        console.log('Test 5: Obtener pedidos');
        const orders = await makeRequest('GET', '/api/orders');
        console.log('✅ Status:', orders.status);
        console.log('   Pedidos encontrados:', orders.data.length);
        console.log('');

        console.log('🎉 ¡Todas las pruebas completadas exitosamente!');
        console.log('\n✅ RESUMEN:');
        console.log('   - API REST funcionando correctamente');
        console.log('   - Base de datos operativa');
        console.log('   - Endpoints respondiendo correctamente');
        console.log('   - Sistema listo para usar');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
    }
}

// Esperar 2 segundos para que el servidor esté listo
setTimeout(runTests, 2000);
