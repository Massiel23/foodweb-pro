const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = './pos.db';

// Eliminar archivo si existe
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️ Archivo pos.db eliminado.');
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('🏗️ Creando esquema limpio...');

    // Restaurantes
    db.run(`CREATE TABLE restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        plan TEXT DEFAULT 'Basico',
        owner_email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Usuarios
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT,
        full_name TEXT,
        role TEXT,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )`);

    // Otras tablas (mínimo para que no explote el servidor)
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER, total REAL, items TEXT, status TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER, name TEXT, price REAL, category_id INTEGER)");
    db.run("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER, name TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, restaurant_id INTEGER, name TEXT, role TEXT)");

    console.log('👤 Insertando usuarios finales...');
    const testEmail = 'demo@foodweb.pro';

    // 1. Matriz
    db.run("INSERT INTO restaurants (id, name, plan, owner_email) VALUES (1, 'Sucursal Matriz', 'Pro', ?)", [testEmail]);

    // 2. Usuarios
    db.run("INSERT INTO users (restaurant_id, username, password, email, full_name, role) VALUES (1, 'admin', 'admin', ?, 'Administrador PRO', 'admin')", [testEmail]);
    db.run("INSERT INTO users (restaurant_id, username, password, email, full_name, role) VALUES (1, 'caja', 'caja', ?, 'Cajero Principal', 'caja')", [testEmail]);

    console.log('✅ Base de datos reconstruida al 100%.');
    db.close();
});
