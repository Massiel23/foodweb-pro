require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Middleware de seguridad
const { helmetConfig, apiLimiter, authenticateToken, authorizeRoles } = require('./src/middleware/security');
const { errorHandler } = require('./src/middleware/errorHandler');
const { productValidators, orderValidators, ticketValidators, idParamValidator } = require('./src/middleware/validators');

// Servicios
const AuthService = require('./src/services/authService');

const app = express();
const server = http.createServer(app);

// IMPORTANTE: Usar el puerto de Render en producción
const PORT = process.env.PORT || 3000;

// Detectar si estamos en producción
const isProduction = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL;

let db;
let authService;

// Función para inicializar la base de datos y configurar rutas
async function initializeApp() {
    if (isProduction) {
        // PostgreSQL para producción
        console.log('🚀 Modo PRODUCCIÓN - Usando PostgreSQL');
        const { Pool } = require('pg');
        
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Crear tablas
            await pool.query(`
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
            `);
            console.log('✅ Tablas creadas');
            
            // Inicializar usuarios por defecto con contraseñas hasheadas
            const bcrypt = require('bcrypt');
            
            // Verificar si ya existen usuarios
            const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
            const userCount = parseInt(existingUsers.rows[0].count);
            
            if (userCount === 0) {
                console.log('👥 Creando usuarios por defecto...');
                
                // Hashear contraseñas
                const adminHash = await bcrypt.hash('Admin2026', 10);
                const cajaHash = await bcrypt.hash('Caja2026', 10);
                
                // Crear usuarios
                await pool.query(
                    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                    ['admin', adminHash, 'admin']
                );
                console.log('   ✓ Usuario admin creado (contraseña: Admin2026)');
                
                await pool.query(
                    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                    ['caja', cajaHash, 'caja']
                );
                console.log('   ✓ Usuario caja creado (contraseña: Caja2026)');
                
                console.log('✅ Usuarios por defecto creados exitosamente');
            } else {
                console.log(`ℹ️  Ya existen ${userCount} usuarios en la base de datos`);
            }
        } catch (err) {
            console.error('❌ Error inicializando base de datos:', err.message);
            throw err;
        }

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

    // Inicializar servicios DESPUÉS de que db esté listo
    authService = new AuthService(dbGet, dbRun);

    // Socket.IO con CORS configurado
    const io = socketIo(server, { 
        cors: { 
            origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
        } 
    });

    // Configurar trust proxy para Render
    if (isProduction) {
        app.set('trust proxy', 1); // Confiar en el primer proxy (Render)
    }

    // Middleware de seguridad
    app.use(helmetConfig);

    // CORS configurado
    const corsOptions = {
        origin: function (origin, callback) {
            // En producción, permitir el dominio de Render
            if (isProduction) {
                // Permitir peticiones sin origin (como Postman) o desde el mismo dominio
                if (!origin || origin.includes('onrender.com')) {
                    callback(null, true);
                } else {
                    callback(null, true); // Temporalmente permitir todos en producción
                }
            } else {
                // En desarrollo, permitir todo
                callback(null, true);
            }
        },
        credentials: true
    };
    app.use(cors(corsOptions));

    // Body parser
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Archivos estáticos
    app.use(express.static(__dirname));

    // Rate limiting en todas las rutas API
    app.use('/api/', apiLimiter);

    // Logging de peticiones (desarrollo)
    if (!isProduction) {
        app.use((req, res, next) => {
            console.log(`${req.method} ${req.path}`);
            next();
        });
    }

    // Socket.IO
    io.on('connection', (socket) => {
        console.log('Usuario conectado:', socket.id);
        socket.on('disconnect', () => console.log('Usuario desconectado:', socket.id));
    });

    // Rutas principales
    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'foodweb-pro.html')));

    // Health check
    app.get('/health', (req, res) => {
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    });

    // ========== RUTAS DE AUTENTICACIÓN ==========
    const authRoutes = require('./src/routes/authRoutes')(authService, io);
    app.use('/api/auth', authRoutes);

    // ========== API USUARIOS (PROTEGIDA) ==========
    app.get('/api/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
        try {
            const rows = await dbQuery('SELECT id, username, role FROM users');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/users/:id', authenticateToken, authorizeRoles('admin'), idParamValidator, async (req, res) => {
        try {
            const result = await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
            io.emit('userDeleted', { id: req.params.id });
            res.json({ changes: result.changes });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ========== API PRODUCTOS (PROTEGIDA) ==========
    app.get('/api/products', authenticateToken, async (req, res) => {
        try {
            const rows = await dbQuery('SELECT * FROM products');
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/products', authenticateToken, authorizeRoles('admin'), productValidators, async (req, res) => {
        const { name, price, img } = req.body;
        try {
            const result = await dbRun('INSERT INTO products (name, price, img) VALUES (?, ?, ?)', [name, price, img || '🍔']);
            const newProduct = { id: result.lastID, name, price, img: img || '🍔' };
            io.emit('productAdded', newProduct);
            res.json(newProduct);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/products/:id', authenticateToken, authorizeRoles('admin'), idParamValidator, async (req, res) => {
        try {
            const result = await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
            io.emit('productDeleted', { id: req.params.id });
            res.json({ changes: result.changes });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ========== API PEDIDOS (PROTEGIDA) ==========
    app.get('/api/orders', authenticateToken, async (req, res) => {
        try {
            const rows = await dbQuery('SELECT * FROM orders ORDER BY created_at DESC');
            const orders = rows.map(row => ({ ...row, items: JSON.parse(row.items) }));
            res.json(orders);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/orders', authenticateToken, orderValidators, async (req, res) => {
        const { employee, items, total, status } = req.body;
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

    app.put('/api/orders/:id', authenticateToken, idParamValidator, async (req, res) => {
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

    app.delete('/api/orders/:id', authenticateToken, authorizeRoles('admin'), idParamValidator, async (req, res) => {
        try {
            const result = await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
            io.emit('orderDeleted', { id: req.params.id });
            res.json({ changes: result.changes });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ========== API TICKETS (PROTEGIDA) ==========
    app.get('/api/tickets', authenticateToken, authorizeRoles('admin', 'caja'), async (req, res) => {
        try {
            const rows = await dbQuery('SELECT * FROM tickets ORDER BY id DESC');
            const tickets = rows.map(row => ({ ...row, items: JSON.parse(row.items) }));
            res.json(tickets);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/tickets', authenticateToken, authorizeRoles('admin', 'caja'), ticketValidators, async (req, res) => {
        const { order_id, employee, items, total, amount_received, change_given, payment_method } = req.body;
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

    // Manejo de errores 404
    app.use((req, res) => {
        res.status(404).json({ error: 'Ruta no encontrada' });
    });

    // Manejo de errores global
    app.use(errorHandler);

    // Iniciar servidor
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        console.log(`📱 Entorno: ${process.env.NODE_ENV || 'development'}`);
        console.log(`💻 Acceso local: http://localhost:${PORT}`);
        if (!isProduction) {
            console.log(`📱 Acceso desde celular: http://192.168.101.53:${PORT}`);
        }
    });
}

// Inicializar la aplicación
initializeApp().catch(err => {
    console.error('💥 Error fatal al inicializar la aplicación:', err);
    process.exit(1);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Apagando...');
    console.error(err);
    server.close(() => {
        process.exit(1);
    });
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Apagando...');
    console.error(err);
    process.exit(1);
});

module.exports = { app, server };
