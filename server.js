const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// IMPORTANTE: Usar el puerto de Render en producción
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Detectar si estamos en producción
const isProduction = process.env.DATABASE_URL !== undefined;

let db;

if (isProduction) {
    // PostgreSQL para producción
    console.log('🚀 Modo PRODUCCIÓN - Usando PostgreSQL');
    const { Pool } = require('pg');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // Crear tablas
    pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        );
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT,
            price REAL,
            img TEXT
        );
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            employee TEXT,
            items TEXT,
            total REAL,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            order_id INTEGER,
            employee TEXT,
            items TEXT,
            total REAL,
            amount_received REAL,
            change_given REAL,
            payment_method TEXT DEFAULT 'Efectivo',
            printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `).then(() => {
        console.log('✅ Tablas creadas');
        // Insertar datos por defecto
        pool.query(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin') ON CONFLICT (username) DO NOTHING`);
        pool.query(`INSERT INTO users (username, password, role) VALUES ('caja', 'caja', 'caja') ON CONFLICT (username) DO NOTHING`);
    });

    db = pool;
} else {
    // SQLite para desarrollo
    console.log('💻 Modo DESARROLLO - Usando SQLite');
    db = new sqlite3.Database('./pos.db');
}

// Helper functions
const dbQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        if (isProduction) {
            const pgSql = sql.replace(/\?/g, (_, i) => `$${params.slice(0, i).length + 1}`);
            db.query(pgSql, params, (err, result) => {
                if (err) reject(err);
                else resolve(result.rows);
            });
        } else {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        if (isProduction) {
            let index = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++index}`);
            db.query(pgSql + ' RETURNING id', params, (err, result) => {
                if (err) reject(err);
                else resolve({ lastID: result.rows[0]?.id, changes: result.rowCount });
            });
        } else {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        if (isProduction) {
            let index = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++index}`);
            db.query(pgSql, params, (err, result) => {
                if (err) reject(err);
                else resolve(result.rows[0]);
            });
        } else {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }
    });
};

// Socket.IO
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    socket.on('disconnect', () => console.log('Usuario desconectado:', socket.id));
});

// Rutas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'hotgogs.html')));

// API Usuarios
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    try {
        const row = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT id, username, role FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Todos los campos requeridos' });
    try {
        const result = await dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
        const newUser = { id: result.lastID, username, role };
        io.emit('userAdded', newUser);
        res.json(newUser);
    } catch (err) {
        if (err.message.includes('UNIQUE') || err.message.includes('duplicate')) {
            return res.status(400).json({ error: 'Usuario ya existe' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
        io.emit('userDeleted', { id: req.params.id });
        res.json({ changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Productos
app.get('/api/products', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM products');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, price, img } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Nombre y precio requeridos' });
    try {
        const result = await dbRun('INSERT INTO products (name, price, img) VALUES (?, ?, ?)', [name, price, img || '🍔']);
        const newProduct = { id: result.lastID, name, price, img: img || '🍔' };
        io.emit('productAdded', newProduct);
        res.json(newProduct);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
        io.emit('productDeleted', { id: req.params.id });
        res.json({ changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Pedidos
app.get('/api/orders', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM orders ORDER BY created_at DESC');
        const orders = rows.map(row => ({ ...row, items: JSON.parse(row.items) }));
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    const { employee, items, total, status } = req.body;
    if (!employee || !items || !total) return res.status(400).json({ error: 'Datos incompletos' });
    try {
        const result = await dbRun('INSERT INTO orders (employee, items, total, status) VALUES (?, ?, ?, ?)', 
            [employee, JSON.stringify(items), total, status || 'Pendiente']);
        const newOrder = { id: result.lastID, employee, items, total, status: status || 'Pendiente', created_at: new Date().toISOString() };
        io.emit('newOrder', newOrder);
        res.json(newOrder);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Estado requerido' });
    try {
        const result = await dbRun('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        io.emit('orderUpdated', { id: parseInt(req.params.id), status });
        res.json({ changes: result.changes, id: req.params.id, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const result = await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
        io.emit('orderDeleted', { id: req.params.id });
        res.json({ changes: result.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Tickets
app.get('/api/tickets', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM tickets ORDER BY id DESC');
        const tickets = rows.map(row => ({ ...row, items: JSON.parse(row.items) }));
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tickets', async (req, res) => {
    const { order_id, employee, items, total, amount_received, change_given, payment_method } = req.body;
    if (!order_id || !employee || !items || total === undefined) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    try {
        const result = await dbRun(
            'INSERT INTO tickets (order_id, employee, items, total, amount_received, change_given, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [order_id, employee, JSON.stringify(items), total, amount_received || 0, change_given || 0, payment_method || 'Efectivo']
        );
        const newTicket = { id: result.lastID, order_id, employee, items, total, amount_received: amount_received || 0, change_given: change_given || 0, payment_method: payment_method || 'Efectivo', printed_at: new Date().toISOString() };
        io.emit('ticketPrinted', newTicket);
        res.json(newTicket);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${PORT} - Modo: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    console.log(`📱 Acceso desde celular: http://192.168.101.53:${PORT}`);
    console.log(`💻 Acceso desde computadora: http://localhost:${PORT}`);
});
