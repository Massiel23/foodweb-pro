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
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Servir archivos estáticos

// Conectar a SQLite
const db = new sqlite3.Database('./pos.db', (err) => {
    if (err) console.error(err.message);
    console.log('Conectado a SQLite.');
});

// Crear tablas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        img TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee TEXT,
        items TEXT,
        total REAL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        employee TEXT,
        items TEXT,
        total REAL,
        amount_received REAL,
        change_given REAL,
        payment_method TEXT DEFAULT 'Efectivo',
        printed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);

    // Agregar columnas faltantes a la tabla tickets si no existen
    db.run(`ALTER TABLE tickets ADD COLUMN amount_received REAL`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.log('Columna amount_received ya existe o error:', err.message);
        }
    });
    
    db.run(`ALTER TABLE tickets ADD COLUMN change_given REAL`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.log('Columna change_given ya existe o error:', err.message);
        }
    });
    
    db.run(`ALTER TABLE tickets ADD COLUMN payment_method TEXT DEFAULT 'Efectivo'`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.log('Columna payment_method ya existe o error:', err.message);
        }
    });

    // Insertar usuarios por defecto
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')`);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('caja', 'caja', 'caja')`);

    // Insertar productos por defecto
    const defaultProducts = [
        { name: 'Hot Dog Clásico', price: 5.00, img: '🐕' },
        { name: 'Hot Dog con Queso', price: 6.50, img: '🐶' },
        { name: 'Hot Dog Deluxe', price: 8.00, img: '🐕‍🦺' },
        { name: 'Bebida Refresco', price: 2.00, img: '🥤' },
        { name: 'Hot Dog Veggie (Animal-Friendly)', price: 7.00, img: '🌱' },
        { name: 'Ensalada Fresca', price: 4.50, img: '🥗' }
    ];

    defaultProducts.forEach(product => {
        db.run(`INSERT OR IGNORE INTO products (name, price, img) VALUES (?, ?, ?)`, 
            [product.name, product.price, product.img]);
    });
});

// Socket.IO para notificaciones en tiempo real
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// ========== RUTAS API ==========

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'hotgogs.html'));
});

// ========== USUARIOS ==========
// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });
        res.json(row);
    });
});

// Obtener usuarios
app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, role FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Agregar usuario
app.post('/api/users', (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'El usuario ya existe' });
            }
            return res.status(500).json({ error: err.message });
        }
        const newUser = { id: this.lastID, username, role };
        io.emit('userAdded', newUser);
        res.json(newUser);
    });
});

// Eliminar usuario
app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('userDeleted', { id: req.params.id });
        res.json({ changes: this.changes });
    });
});

// ========== PRODUCTOS ==========
// Obtener productos
app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Agregar producto
app.post('/api/products', (req, res) => {
    const { name, price, img } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    }

    db.run('INSERT INTO products (name, price, img) VALUES (?, ?, ?)', [name, price, img || '🍔'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const newProduct = { id: this.lastID, name, price, img: img || '🍔' };
        io.emit('productAdded', newProduct);
        res.json(newProduct);
    });
});

// Eliminar producto
app.delete('/api/products/:id', (req, res) => {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('productDeleted', { id: req.params.id });
        res.json({ changes: this.changes });
    });
});

// ========== PEDIDOS ==========
// Obtener pedidos
app.get('/api/orders', (req, res) => {
    db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parsear items de JSON string a objeto
        const orders = rows.map(row => ({
            ...row,
            items: JSON.parse(row.items)
        }));
        res.json(orders);
    });
});

// Agregar pedido
app.post('/api/orders', (req, res) => {
    const { employee, items, total, status } = req.body;
    
    if (!employee || !items || !total) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    db.run('INSERT INTO orders (employee, items, total, status) VALUES (?, ?, ?, ?)', 
        [employee, JSON.stringify(items), total, status || 'Pendiente'], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const newOrder = { 
                id: this.lastID, 
                employee, 
                items, 
                total, 
                status: status || 'Pendiente',
                created_at: new Date().toISOString()
            };
            io.emit('newOrder', newOrder); // Notificación en tiempo real
            res.json(newOrder);
        }
    );
});

// Actualizar pedido
app.put('/api/orders/:id', (req, res) => {
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Estado requerido' });
    }

    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('orderUpdated', { id: parseInt(req.params.id), status }); // Notificación en tiempo real
        res.json({ changes: this.changes, id: req.params.id, status });
    });
});

// Eliminar pedido
app.delete('/api/orders/:id', (req, res) => {
    db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('orderDeleted', { id: req.params.id });
        res.json({ changes: this.changes });
    });
});

// ========== TICKETS ==========
// Obtener tickets
app.get('/api/tickets', (req, res) => {
    db.all('SELECT * FROM tickets ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parsear items de JSON string a objeto
        const tickets = rows.map(row => ({
            ...row,
            items: JSON.parse(row.items)
        }));
        res.json(tickets);
    });
});

// Agregar ticket
app.post('/api/tickets', (req, res) => {
    const { order_id, employee, items, total, amount_received, change_given, payment_method } = req.body;
    
    console.log('POST /api/tickets recibido:', { order_id, employee, items, total, amount_received, change_given, payment_method });
    
    // Validación mejorada
    if (!order_id) {
        console.log('Error: order_id faltante');
        return res.status(400).json({ error: 'order_id es requerido' });
    }
    if (!employee) {
        console.log('Error: employee faltante');
        return res.status(400).json({ error: 'employee es requerido' });
    }
    if (!items) {
        console.log('Error: items faltante');
        return res.status(400).json({ error: 'items es requerido' });
    }
    if (total === undefined || total === null) {
        console.log('Error: total faltante o undefined');
        return res.status(400).json({ error: 'total es requerido' });
    }

    db.run('INSERT INTO tickets (order_id, employee, items, total, amount_received, change_given, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [order_id, employee, JSON.stringify(items), total, amount_received || 0, change_given || 0, payment_method || 'Efectivo'], 
        function(err) {
            if (err) {
                console.log('Error en INSERT:', err);
                return res.status(500).json({ error: err.message });
            }
            const newTicket = { 
                id: this.lastID, 
                order_id, 
                employee, 
                items, 
                total,
                amount_received: amount_received || 0,
                change_given: change_given || 0,
                payment_method: payment_method || 'Efectivo',
                printed_at: new Date().toISOString()
            };
            console.log('Ticket creado exitosamente:', newTicket);
            io.emit('ticketPrinted', newTicket); // Notificación en tiempo real
            res.json(newTicket);
        }
    );
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});