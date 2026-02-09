# 💻 EJEMPLOS DE IMPLEMENTACIÓN - MEJORAS CRÍTICAS

## 🔐 1. SEGURIDAD COMPLETA - Implementación Paso a Paso

### Paso 1: Instalar Dependencias

```bash
npm install bcrypt jsonwebtoken express-validator express-rate-limit helmet cors dotenv
npm install --save-dev nodemon
```

### Paso 2: Crear Archivo .env

```env
# .env
NODE_ENV=development
PORT=3000

# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/hotdogs_pos

# Seguridad
JWT_SECRET=tu-secreto-jwt-super-seguro-de-al-menos-64-caracteres-aleatorios
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.101.53:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### Paso 3: Crear .env.example (para compartir en Git)

```env
# .env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=change-this-to-a-random-secret
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=10
ALLOWED_ORIGINS=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
```

### Paso 4: Actualizar .gitignore

```gitignore
# .gitignore
node_modules/
.env
.env.local
.env.*.local
*.log
logs/
pos.db
*.sqlite
*.sqlite3
.DS_Store
coverage/
.vscode/
.idea/
dist/
build/
```

### Paso 5: Crear Middleware de Seguridad

```javascript
// src/middleware/security.js
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Middleware de autenticación JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            error: 'Acceso denegado. Token no proporcionado.' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ 
            error: 'Token inválido o expirado.' 
        });
    }
};

// Middleware de autorización por rol
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'No autenticado.' 
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'No tienes permisos para realizar esta acción.' 
            });
        }

        next();
    };
};

// Rate limiter para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: {
        error: 'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiter general para API
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Demasiadas peticiones desde esta IP. Por favor, intenta más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Configuración de Helmet para seguridad HTTP
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
    crossOriginEmbedderPolicy: false,
});

module.exports = {
    authenticateToken,
    authorizeRoles,
    loginLimiter,
    apiLimiter,
    helmetConfig
};
```

### Paso 6: Crear Validadores

```javascript
// src/middleware/validators.js
const { body, param, query, validationResult } = require('express-validator');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Datos inválidos',
            details: errors.array() 
        });
    }
    next();
};

// Validadores para autenticación
const loginValidators = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('El usuario debe tener entre 3 y 50 caracteres')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('El usuario solo puede contener letras, números y guiones bajos'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    handleValidationErrors
];

const registerValidators = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('El usuario debe tener entre 3 y 50 caracteres')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('El usuario solo puede contener letras, números y guiones bajos'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
    body('role')
        .isIn(['admin', 'caja', 'empleado'])
        .withMessage('Rol inválido'),
    handleValidationErrors
];

// Validadores para productos
const productValidators = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('El nombre debe tener entre 1 y 100 caracteres')
        .escape(),
    body('price')
        .isFloat({ min: 0.01 })
        .withMessage('El precio debe ser mayor a 0'),
    body('img')
        .optional()
        .trim()
        .isLength({ max: 10 })
        .withMessage('El emoji debe tener máximo 10 caracteres'),
    handleValidationErrors
];

// Validadores para pedidos
const orderValidators = [
    body('employee')
        .trim()
        .notEmpty()
        .withMessage('El empleado es requerido'),
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe haber al menos un item'),
    body('items.*.id')
        .isInt({ min: 1 })
        .withMessage('ID de producto inválido'),
    body('items.*.name')
        .trim()
        .notEmpty()
        .withMessage('Nombre de producto requerido'),
    body('items.*.price')
        .isFloat({ min: 0 })
        .withMessage('Precio inválido'),
    body('items.*.quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Cantidad inválida'),
    body('total')
        .isFloat({ min: 0.01 })
        .withMessage('Total inválido'),
    body('status')
        .optional()
        .isIn(['Pendiente', 'En Preparación', 'Finalizado', 'Cobrado'])
        .withMessage('Estado inválido'),
    handleValidationErrors
];

// Validadores para tickets
const ticketValidators = [
    body('order_id')
        .isInt({ min: 1 })
        .withMessage('ID de pedido inválido'),
    body('employee')
        .trim()
        .notEmpty()
        .withMessage('Empleado requerido'),
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe haber al menos un item'),
    body('total')
        .isFloat({ min: 0.01 })
        .withMessage('Total inválido'),
    body('amount_received')
        .isFloat({ min: 0 })
        .withMessage('Monto recibido inválido'),
    body('change_given')
        .isFloat({ min: 0 })
        .withMessage('Cambio inválido'),
    body('payment_method')
        .optional()
        .isIn(['Efectivo', 'Tarjeta', 'Transferencia'])
        .withMessage('Método de pago inválido'),
    handleValidationErrors
];

// Validadores para parámetros de ID
const idParamValidator = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID inválido'),
    handleValidationErrors
];

// Validadores para paginación
const paginationValidators = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Página inválida'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Límite inválido (1-100)'),
    handleValidationErrors
];

module.exports = {
    loginValidators,
    registerValidators,
    productValidators,
    orderValidators,
    ticketValidators,
    idParamValidator,
    paginationValidators,
    handleValidationErrors
};
```

### Paso 7: Crear Servicio de Autenticación

```javascript
// src/services/authService.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../config/database');

class AuthService {
    async login(username, password) {
        // Buscar usuario
        const user = await dbGet(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            throw new Error('Credenciales inválidas');
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            throw new Error('Credenciales inválidas');
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // No devolver la contraseña
        const { password: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            token
        };
    }

    async register(username, password, role) {
        // Verificar si el usuario ya existe
        const existingUser = await dbGet(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUser) {
            throw new Error('El usuario ya existe');
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(
            password,
            parseInt(process.env.BCRYPT_ROUNDS) || 10
        );

        // Crear usuario
        const result = await dbRun(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        return {
            id: result.lastID,
            username,
            role
        };
    }

    async changePassword(userId, oldPassword, newPassword) {
        // Obtener usuario
        const user = await dbGet(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // Verificar contraseña actual
        const isValidPassword = await bcrypt.compare(oldPassword, user.password);
        
        if (!isValidPassword) {
            throw new Error('Contraseña actual incorrecta');
        }

        // Hash de la nueva contraseña
        const hashedPassword = await bcrypt.hash(
            newPassword,
            parseInt(process.env.BCRYPT_ROUNDS) || 10
        );

        // Actualizar contraseña
        await dbRun(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        return { message: 'Contraseña actualizada exitosamente' };
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw new Error('Token inválido o expirado');
        }
    }
}

module.exports = new AuthService();
```

### Paso 8: Actualizar Rutas con Seguridad

```javascript
// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { loginValidators, registerValidators } = require('../middleware/validators');
const { loginLimiter, authenticateToken, authorizeRoles } = require('../middleware/security');

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', loginLimiter, loginValidators, async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const result = await authService.login(username, password);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario (solo admin)
 * @access  Private (Admin)
 */
router.post('/register', 
    authenticateToken, 
    authorizeRoles('admin'),
    registerValidators, 
    async (req, res, next) => {
        try {
            const { username, password, role } = req.body;
            const user = await authService.register(username, password, role);
            res.status(201).json(user);
        } catch (error) {
            if (error.message === 'El usuario ya existe') {
                return res.status(409).json({ error: error.message });
            }
            next(error);
        }
    }
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.post('/change-password', authenticateToken, async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const result = await authService.changePassword(
            req.user.id,
            oldPassword,
            newPassword
        );
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token
 * @access  Private
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión (invalidar token en cliente)
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
    // En una implementación real, podrías agregar el token a una lista negra
    res.json({ message: 'Sesión cerrada exitosamente' });
});

module.exports = router;
```

### Paso 9: Actualizar server.js Principal

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Middleware de seguridad
const { helmetConfig, apiLimiter } = require('./src/middleware/security');
const { errorHandler } = require('./src/middleware/errorHandler');

// Rutas
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const ticketRoutes = require('./src/routes/ticketRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { 
    cors: { 
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
    } 
});

const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmetConfig);

// CORS configurado
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting en todas las rutas API
app.use('/api/', apiLimiter);

// Logging de peticiones (desarrollo)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Rutas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hotgogs.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV 
    });
});

// Socket.IO
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// Hacer io accesible en las rutas
app.set('io', io);

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use(errorHandler);

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Entorno: ${process.env.NODE_ENV}`);
    console.log(`💻 Acceso local: http://localhost:${PORT}`);
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

module.exports = { app, server, io };
```

### Paso 10: Actualizar Frontend (api.js)

```javascript
// public/js/api.js
class API {
    constructor(baseURL) {
        if (!baseURL) {
            const hostname = window.location.hostname;
            
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                baseURL = 'http://localhost:3000';
            } else if (hostname.includes('onrender.com')) {
                baseURL = window.location.origin;
            } else if (hostname.includes('192.168.')) {
                baseURL = 'http://192.168.101.53:3000';
            } else {
                baseURL = window.location.origin;
            }
        }
        this.baseURL = baseURL;
        this.token = localStorage.getItem('token');
        console.log('🌐 API conectada a:', this.baseURL);
    }

    // Obtener headers con token
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Guardar token
    setToken(token) {
        this.token = token;
        localStorage.setItem('token', token);
    }

    // Eliminar token
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    }

    // Método genérico para hacer peticiones
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: this.getHeaders(),
                ...options
            });

            const data = await response.json();

            if (!response.ok) {
                // Si el token expiró, limpiar y redirigir al login
                if (response.status === 401 || response.status === 403) {
                    this.clearToken();
                    window.location.href = '/';
                }
                throw new Error(data.error || 'Error en la petición');
            }

            return data;
        } catch (error) {
            console.error(`Error en ${endpoint}:`, error);
            throw error;
        }
    }

    // ========== AUTENTICACIÓN ==========
    async login(username, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        // Guardar token
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    async logout() {
        try {
            await this.request('/api/auth/logout', {
                method: 'POST'
            });
        } finally {
            this.clearToken();
        }
    }

    async verifyToken() {
        return this.request('/api/auth/verify');
    }

    async changePassword(oldPassword, newPassword) {
        return this.request('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword })
        });
    }

    // ========== USUARIOS ==========
    async getUsers() {
        return this.request('/api/users');
    }

    async addUser(username, password, role) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, role })
        });
    }

    async deleteUser(id) {
        return this.request(`/api/users/${id}`, {
            method: 'DELETE'
        });
    }

    // ========== PRODUCTOS ==========
    async getProducts() {
        return this.request('/api/products');
    }

    async addProduct(name, price, img) {
        return this.request('/api/products', {
            method: 'POST',
            body: JSON.stringify({ name, price, img })
        });
    }

    async deleteProduct(id) {
        return this.request(`/api/products/${id}`, {
            method: 'DELETE'
        });
    }

    // ========== PEDIDOS ==========
    async getOrders(page = 1, limit = 20) {
        return this.request(`/api/orders?page=${page}&limit=${limit}`);
    }

    async createOrder(employee, items, total, status = 'Pendiente') {
        return this.request('/api/orders', {
            method: 'POST',
            body: JSON.stringify({ employee, items, total, status })
        });
    }

    async updateOrderStatus(id, status) {
        return this.request(`/api/orders/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }

    async deleteOrder(id) {
        return this.request(`/api/orders/${id}`, {
            method: 'DELETE'
        });
    }

    // ========== TICKETS ==========
    async getTickets() {
        return this.request('/api/tickets');
    }

    async createTicket(order_id, employee, items, total, amount_received, change_given, payment_method) {
        return this.request('/api/tickets', {
            method: 'POST',
            body: JSON.stringify({ 
                order_id, 
                employee, 
                items, 
                total, 
                amount_received, 
                change_given, 
                payment_method 
            })
        });
    }
}

// Exportar instancia única de la API
const api = new API();
```

### Paso 11: Script de Migración de Contraseñas

```javascript
// scripts/migrate-passwords.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

async function migratePasswords() {
    const db = new sqlite3.Database('./pos.db');
    
    console.log('🔄 Iniciando migración de contraseñas...');
    
    // Obtener todos los usuarios
    db.all('SELECT * FROM users', async (err, users) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        console.log(`📊 Encontrados ${users.length} usuarios`);
        
        for (const user of users) {
            // Verificar si la contraseña ya está hasheada
            if (user.password.startsWith('$2b$')) {
                console.log(`✅ ${user.username} - Ya tiene contraseña hasheada`);
                continue;
            }
            
            // Hashear contraseña
            const hashedPassword = await bcrypt.hash(user.password, 10);
            
            // Actualizar en base de datos
            db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, user.id],
                (err) => {
                    if (err) {
                        console.error(`❌ Error actualizando ${user.username}:`, err);
                    } else {
                        console.log(`✅ ${user.username} - Contraseña actualizada`);
                    }
                }
            );
        }
        
        console.log('✅ Migración completada');
        db.close();
    });
}

migratePasswords();
```

### Paso 12: Actualizar package.json

```json
{
  "name": "hotdog-pos-system",
  "version": "2.0.0",
  "description": "Sistema POS para Hot Dog Heaven - Callejones de Tamazula",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "reset-db": "node reset-db.js",
    "migrate-passwords": "node scripts/migrate-passwords.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "keywords": [
    "pos",
    "hotdog",
    "restaurant",
    "point-of-sale"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "bcrypt": "^5.1.1",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "socket.io": "^4.6.1",
    "sqlite3": "^5.1.6",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "eslint": "^8.55.0",
    "jest": "^29.7.0",
    "nodemon": "^3.0.2",
    "supertest": "^6.3.3"
  }
}
```

---

## 🧪 TESTING

### Test de Autenticación

```javascript
// tests/auth.test.js
const request = require('supertest');
const { app } = require('../server');

describe('Auth API', () => {
    describe('POST /api/auth/login', () => {
        test('Debe iniciar sesión con credenciales válidas', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'admin',
                    password: 'admin123'
                });
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
