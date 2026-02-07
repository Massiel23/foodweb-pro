// Script para resetear la base de datos
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Eliminar base de datos existente si existe
if (fs.existsSync('./pos.db')) {
    fs.unlinkSync('./pos.db');
    console.log('✅ Base de datos anterior eliminada');
}

// Crear nueva base de datos
const db = new sqlite3.Database('./pos.db', (err) => {
    if (err) {
        console.error('❌ Error al crear base de datos:', err.message);
        process.exit(1);
    }
    console.log('✅ Nueva base de datos creada');
});

db.serialize(() => {
    // Crear tabla de usuarios
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`, (err) => {
        if (err) {
            console.error('❌ Error al crear tabla users:', err.message);
        } else {
            console.log('✅ Tabla users creada');
        }
    });

    // Crear tabla de productos
    db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        img TEXT
    )`, (err) => {
        if (err) {
            console.error('❌ Error al crear tabla products:', err.message);
        } else {
            console.log('✅ Tabla products creada');
        }
    });

    // Crear tabla de pedidos
    db.run(`CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ Error al crear tabla orders:', err.message);
        } else {
            console.log('✅ Tabla orders creada');
        }
    });

    // Crear tabla de tickets
    db.run(`CREATE TABLE tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        employee TEXT,
        items TEXT,
        total REAL,
        date TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )`, (err) => {
        if (err) {
            console.error('❌ Error al crear tabla tickets:', err.message);
        } else {
            console.log('✅ Tabla tickets creada');
        }
    });

    // Insertar usuarios por defecto
    db.run(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')`, (err) => {
        if (err) {
            console.error('❌ Error al insertar usuario admin:', err.message);
        } else {
            console.log('✅ Usuario admin creado');
        }
    });

    db.run(`INSERT INTO users (username, password, role) VALUES ('caja', 'caja', 'caja')`, (err) => {
        if (err) {
            console.error('❌ Error al insertar usuario caja:', err.message);
        } else {
            console.log('✅ Usuario caja creado');
        }
    });

    // Insertar productos por defecto
    const defaultProducts = [
        { name: 'Hot Dog Clásico', price: 5.00, img: '🐕' },
        { name: 'Hot Dog con Queso', price: 6.50, img: '🐶' },
        { name: 'Hot Dog Deluxe', price: 8.00, img: '🐕‍🦺' },
        { name: 'Bebida Refresco', price: 2.00, img: '🥤' },
        { name: 'Hot Dog Veggie (Animal-Friendly)', price: 7.00, img: '🌱' },
        { name: 'Ensalada Fresca', price: 4.50, img: '🥗' }
    ];

    let productCount = 0;
    defaultProducts.forEach(product => {
        db.run(`INSERT INTO products (name, price, img) VALUES (?, ?, ?)`, 
            [product.name, product.price, product.img],
            (err) => {
                if (err) {
                    console.error(`❌ Error al insertar producto ${product.name}:`, err.message);
                } else {
                    productCount++;
                    if (productCount === defaultProducts.length) {
                        console.log(`✅ ${productCount} productos insertados`);
                    }
                }
            }
        );
    });

    // Verificar usuarios insertados
    setTimeout(() => {
        db.all('SELECT * FROM users', [], (err, rows) => {
            if (err) {
                console.error('❌ Error al verificar usuarios:', err.message);
            } else {
                console.log('\n📋 Usuarios en la base de datos:');
                rows.forEach(user => {
                    console.log(`   - ${user.username} (${user.role})`);
                });
            }
            
            db.close((err) => {
                if (err) {
                    console.error('❌ Error al cerrar base de datos:', err.message);
                } else {
                    console.log('\n✅ Base de datos reseteada correctamente');
                    console.log('\n🚀 Ahora puedes iniciar el servidor con: npm start');
                    console.log('   Credenciales: admin/admin o caja/caja');
                }
            });
        });
    }, 1000);
});
