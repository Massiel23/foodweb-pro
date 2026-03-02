require('dotenv').config();
const { Pool } = require('pg');

async function initDB() {
    console.log('🔄 Iniciando configuración de PostgreSQL...\n');

    if (!process.env.DATABASE_URL) {
        console.error('❌ ERROR: DATABASE_URL no está configurado en el entorno.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL.\n');

        console.log('📋 Creando tablas en PostgreSQL (Estructura Multi-Sucursal)...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurants (
                id SERIAL PRIMARY KEY,
                name TEXT,
                plan TEXT DEFAULT 'Basico',
                owner_email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER REFERENCES restaurants(id),
                username TEXT UNIQUE,
                password TEXT,
                email TEXT,
                full_name TEXT,
                role TEXT
            );

            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER,
                name TEXT,
                price REAL,
                img TEXT,
                modifiers TEXT,
                category_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER,
                name TEXT
            );

            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER,
                name TEXT,
                role TEXT
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER,
                employee TEXT,
                items TEXT,
                total REAL,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                restaurant_id INTEGER,
                order_id INTEGER REFERENCES orders(id),
                employee TEXT,
                items TEXT,
                total REAL,
                amount_received REAL,
                change_given REAL,
                payment_method TEXT DEFAULT 'Efectivo',
                printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date TEXT
            );
        `);
        console.log('✅ Tablas creados exitosamente.\n');

        console.log('👤 Verificando usuario administrador maestro...');

        const testEmail = 'demo@foodweb.pro';

        // Verificar si ya existe el restaurante matriz
        const restCheck = await pool.query('SELECT id FROM restaurants WHERE owner_email = $1', [testEmail]);
        let restId;

        if (restCheck.rows.length === 0) {
            const restResult = await pool.query(
                "INSERT INTO restaurants (name, plan, owner_email) VALUES ('Sucursal Matriz', 'Pro', $1) RETURNING id",
                [testEmail]
            );
            restId = restResult.rows[0].id;
            console.log('   ✓ Restaurante matriz creado.');
        } else {
            restId = restCheck.rows[0].id;
        }

        // Verificar o crear usuarios
        const adminCheck = await pool.query("SELECT id FROM users WHERE username = 'admin'");
        if (adminCheck.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (restaurant_id, username, password, email, full_name, role) VALUES ($1, 'admin', 'admin', $2, 'Administrador PRO', 'admin')",
                [restId, testEmail]
            );
            console.log('   ✓ Usuario admin creado.');
        }

        const cajaCheck = await pool.query("SELECT id FROM users WHERE username = 'caja'");
        if (cajaCheck.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (restaurant_id, username, password, email, full_name, role) VALUES ($1, 'caja', 'caja', $2, 'Cajero Principal', 'caja')",
                [restId, testEmail]
            );
            console.log('   ✓ Usuario caja creado.');
        }

        console.log('\n🎉 ¡BASE DE DATOS POSTGRESQL INICIALIZADA CORRECTAMENTE!');
        console.log('Ya puedes iniciar sesión en Render con el usuario "admin" y contraseña "admin".\n');

    } catch (error) {
        console.error('\n❌ Error al configurar la base de datos:', error.message);
    } finally {
        await pool.end();
    }
}

initDB();
