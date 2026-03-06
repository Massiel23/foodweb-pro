const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// PRIORIDAD: Puerto de Render en producción
const PORT = process.env.PORT || 10000;

console.log('🔍 Diagnóstico de Entorno:', {
    port_env: process.env.PORT,
    port_used: PORT,
    node_env: process.env.NODE_ENV,
    db_set: !!process.env.DATABASE_URL
});

// 1. MIDDLEWARE BASE
app.use(cors());
app.use(bodyParser.json());

// Log de todas las peticiones para depuración (CRITICAL)
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// 2. ARCHIVOS ESTÁTICOS (Prioridad para evitar errores de CSS/JS)
app.use(express.static(path.join(__dirname)));

// 3. BASE DE DATOS
const isProduction = process.env.DATABASE_URL !== undefined;
let db;

if (isProduction) {
    console.log('🚀 Modo PRODUCCIÓN - Usando PostgreSQL');
    const { Pool } = require('pg');
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
} else {
    console.log('💻 Modo DESARROLLO - Usando SQLite');
    db = new sqlite3.Database('./pos.db');
}

// Helpers DB
const dbQuery = (sql, params = []) => new Promise((resolve, reject) => {
    if (isProduction) {
        let index = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++index}`);
        db.query(pgSql, params, (err, result) => err ? reject(err) : resolve(result.rows));
    } else {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    }
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    if (isProduction) {
        let index = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++index}`);
        db.query(pgSql + ' RETURNING id', params, (err, result) => err ? reject(err) : resolve({ lastID: result.rows[0]?.id, changes: result.rowCount }));
    } else {
        db.run(sql, params, function (err) { err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }); });
    }
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    if (isProduction) {
        let index = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++index}`);
        db.query(pgSql, params, (err, result) => err ? reject(err) : resolve(result.rows[0]));
    } else {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    }
});

// Migración Automática de Tablas Extra
(async () => {
    try {
        if (isProduction) {
            await db.query(`
                CREATE TABLE IF NOT EXISTS tables (
                    id SERIAL PRIMARY KEY,
                    restaurant_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    assigned_user_id INTEGER
                )
            `);
            await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_name TEXT;`).catch(() => null);
        } else {
            db.run(`
                CREATE TABLE IF NOT EXISTS tables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    restaurant_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    assigned_user_id INTEGER
                )
            `);
            db.run(`ALTER TABLE orders ADD COLUMN table_name TEXT;`, (err) => {
                if (err && !err.message.includes("duplicate column name")) {
                    console.error("Aviso SQLite:", err.message);
                }
            });
        }
        console.log("✅ Tablas extra sincronizadas (Mesas y Opciones de Carrito)");
    } catch (e) {
        console.error("Error sincronizando DB:", e.message);
    }
})();

// 4. SOCKET.IO
io.on('connection', (socket) => {
    socket.on('joinRestaurant', (restaurantId) => {
        if (restaurantId) {
            socket.join(`restaurant_${restaurantId}`);
            console.log(`Socket ${socket.id} unido a restaurante ${restaurantId}`);
        }
    });
});

// 5. MIDDLEWARE API
const requireRestaurantId = (req, res, next) => {
    const publicPaths = ['/login', '/restaurants/register', '/forgot-password', '/reset-password'];
    if (publicPaths.includes(req.path)) return next();

    const restaurantId = req.headers['x-restaurant-id'];
    if (!restaurantId) return res.status(400).json({ error: 'Restaurant ID es requerido' });
    req.restaurantId = parseInt(restaurantId);
    next();
};

const apiRouter = express.Router();
apiRouter.use(requireRestaurantId);
app.use('/api', apiRouter);

// 6. RUTAS DE API (Consolidadas en apiRouter)

// Auth & Registro
apiRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dbGet('SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?', [username, username, password]);
        if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
        const rest = await dbGet('SELECT name FROM restaurants WHERE id = ?', [user.restaurant_id]);
        user.restaurant_name = rest ? rest.name : 'Mi Restaurante';
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/restaurants/register', async (req, res) => {
    const { restaurantName, email, fullName, password, plan } = req.body;
    try {
        const restResult = await dbRun('INSERT INTO restaurants (name, plan, owner_email) VALUES (?, ?, ?)', [restaurantName, plan || 'Basico', email]);
        const restaurantId = restResult.lastID;
        await dbRun('INSERT INTO users (restaurant_id, username, password, email, full_name, role) VALUES (?, ?, ?, ?, ?, ?)',
            [restaurantId, email.split('@')[0], password, email, fullName, 'admin']);
        res.json({ success: true, restaurantId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Perfil y Sucursales
apiRouter.get('/profile', async (req, res) => {
    try {
        const userId = req.query.userId;
        // Obtener usuario con su restaurant_id real
        const user = await dbGet('SELECT id, username, email, full_name, role, restaurant_id FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const userPrimaryRest = await dbGet('SELECT * FROM restaurants WHERE id = ?', [user.restaurant_id]);
        let finalRestaurantId = req.restaurantId;

        // SEGURIDAD: Validar si el usuario tiene permiso para ver el restaurante del header
        if (user.role !== 'admin') {
            // Si no es admin, forzar SIEMPRE su restaurante asignado
            finalRestaurantId = user.restaurant_id;
        } else {
            // Si es admin, validar que el restaurante solicitado pertenezca al mismo dueño (owner_email)
            const requestedRest = await dbGet('SELECT owner_email FROM restaurants WHERE id = ?', [req.restaurantId]);
            if (!requestedRest || requestedRest.owner_email !== userPrimaryRest.owner_email) {
                finalRestaurantId = user.restaurant_id;
            }
        }

        const restaurant = await dbGet('SELECT * FROM restaurants WHERE id = ?', [finalRestaurantId]);
        let branches = [];
        if (user.role === 'admin' && restaurant && restaurant.owner_email) {
            branches = await dbQuery('SELECT id, name, plan FROM restaurants WHERE owner_email = ?', [restaurant.owner_email]);
        }
        res.json({ user, restaurant, branches });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/restaurants/branch', async (req, res) => {
    const { name } = req.body;
    try {
        const currentRest = await dbGet('SELECT plan, owner_email FROM restaurants WHERE id = ?', [req.restaurantId]);
        if (!currentRest || currentRest.plan.toLowerCase() !== 'pro') return res.status(403).json({ error: 'Plan Pro requerido' });

        // Crear restaurante con el mismo owner_email
        const result = await dbRun('INSERT INTO restaurants (name, plan, owner_email) VALUES (?, ?, ?)', [name, 'Pro', currentRest.owner_email]);
        const newRestId = result.lastID;

        // NO creamos usuario admin espejo porque el username/email son UNIQUE globales.
        // El sistema de perfiles ya permite al dueño cambiar de sucursal basándose en el owner_email.

        res.json({ success: true, restaurantId: newRestId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/restaurants/plan', async (req, res) => {
    const { plan } = req.body;
    try {
        await dbRun('UPDATE restaurants SET plan = ? WHERE id = ?', [plan, req.restaurantId]);
        res.json({ success: true, plan });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Usuarios
apiRouter.get('/users', async (req, res) => {
    try {
        // Se añade password a la consulta para mostrar en el frontend (solo admin puede verlo)
        const rows = await dbQuery('SELECT id, username, role, password FROM users WHERE restaurant_id = ?', [req.restaurantId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/users', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const result = await dbRun('INSERT INTO users (restaurant_id, username, password, role) VALUES (?, ?, ?, ?)', [req.restaurantId, username, password, role]);
        res.json({ id: result.lastID, username, role });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/users/:id', async (req, res) => {
    try {
        // Prevenir borrar al administrador principal de la sucursal por seguridad
        await dbRun("DELETE FROM users WHERE id = ? AND restaurant_id = ? AND role != 'admin'", [req.params.id, req.restaurantId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Productos y Categorías
apiRouter.get('/products', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM products WHERE restaurant_id = ?', [req.restaurantId]);
        const products = rows.map(r => ({ ...r, modifiers: r.modifiers ? JSON.parse(r.modifiers) : [] }));
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/products', async (req, res) => {
    const { name, price, img, modifiers } = req.body;
    try {
        const result = await dbRun('INSERT INTO products (restaurant_id, name, price, img, modifiers) VALUES (?, ?, ?, ?, ?)',
            [req.restaurantId, name, price, img || '🍔', JSON.stringify(modifiers || [])]);
        res.json({ id: result.lastID, name });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/products/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM products WHERE id = ? AND restaurant_id = ?', [req.params.id, req.restaurantId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mesas
apiRouter.get('/tables', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM tables WHERE restaurant_id = ?', [req.restaurantId]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/tables', async (req, res) => {
    const { name, assigned_user_id } = req.body;
    try {
        const result = await dbRun('INSERT INTO tables (restaurant_id, name, assigned_user_id) VALUES (?, ?, ?)', [req.restaurantId, name, assigned_user_id || null]);
        res.json({ id: result.lastID, name, assigned_user_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/tables/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM tables WHERE id = ? AND restaurant_id = ?', [req.params.id, req.restaurantId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/tables/:id', async (req, res) => {
    const { assigned_user_id } = req.body;
    try {
        await dbRun('UPDATE tables SET assigned_user_id = ? WHERE id = ? AND restaurant_id = ?', [assigned_user_id || null, req.params.id, req.restaurantId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Órdenes
apiRouter.get('/orders', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC', [req.restaurantId]);
        res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/orders', async (req, res) => {
    const { employee, items, total, status, table_name } = req.body;
    try {
        const result = await dbRun('INSERT INTO orders (restaurant_id, employee, items, total, status, table_name) VALUES (?, ?, ?, ?, ?, ?)',
            [req.restaurantId, employee, JSON.stringify(items), total, status || 'pendiente', table_name || null]);
        io.to(`restaurant_${req.restaurantId}`).emit('newOrder', { id: result.lastID, employee, items, total, status, table_name });
        res.json({ id: result.lastID });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.put('/orders/:id', async (req, res) => {
    try {
        await dbRun('UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?', [req.body.status, req.params.id, req.restaurantId]);
        io.to(`restaurant_${req.restaurantId}`).emit('orderUpdated', { id: req.params.id, status: req.body.status });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tickets
apiRouter.get('/tickets', async (req, res) => {
    try {
        const rows = await dbQuery('SELECT * FROM tickets WHERE restaurant_id = ? ORDER BY printed_at DESC', [req.restaurantId]);
        res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/tickets', async (req, res) => {
    const { order_id, employee, items, total, amount_received, change_given, payment_method } = req.body;
    try {
        const result = await dbRun('INSERT INTO tickets (restaurant_id, order_id, employee, items, total, amount_received, change_given, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.restaurantId, order_id, employee, JSON.stringify(items), total, amount_received, change_given, payment_method]);
        res.json({ id: result.lastID });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Otras rutas de app
app.get('*', (req, res) => {
    // Si no es una ruta de API ni un archivo estático, servir la app principal
    res.sendFile(path.join(__dirname, 'foodweb-pro.html'));
});

// INICIO
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR ACTIVO EN PUERTO ${PORT}`);
});
