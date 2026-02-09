# 📋 PLAN DE MEJORAS Y ACTUALIZACIONES - HOT DOGS POS SYSTEM

## 🎯 RESUMEN EJECUTIVO

Tu sistema POS es funcional y tiene buenas bases, pero requiere mejoras críticas en **seguridad**, **arquitectura** y **mantenibilidad**. Este plan está organizado por prioridad.

---

## 🔴 PRIORIDAD CRÍTICA (Implementar INMEDIATAMENTE)

### 1. SEGURIDAD - Contraseñas y Autenticación

**Problema Actual:**
```javascript
// ❌ PELIGRO: Contraseñas en texto plano
const row = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', 
    [username, password]);
```

**Solución:**
```javascript
// ✅ Usar bcrypt para hash de contraseñas
const bcrypt = require('bcrypt');

// Al crear usuario
const hashedPassword = await bcrypt.hash(password, 10);
await dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
    [username, hashedPassword, role]);

// Al hacer login
const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
}
```

**Implementación:**
```bash
npm install bcrypt jsonwebtoken
```

### 2. SEGURIDAD - Implementar JWT para Sesiones

**Problema:** Sin gestión de sesiones seguras

**Solución:**
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-cambiar-en-produccion';

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
}

// Al hacer login exitoso
const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
);
res.json({ user, token });
```

### 3. SEGURIDAD - Variables de Entorno

**Problema:** Configuración hardcodeada

**Solución:**
```bash
npm install dotenv
```

Crear `.env`:
```env
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Seguridad
JWT_SECRET=tu-secreto-super-seguro-aleatorio-de-64-caracteres-minimo
SESSION_SECRET=otro-secreto-diferente-para-sesiones

# Servidor
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://tu-dominio.com
```

Actualizar `server.js`:
```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';
```

### 4. SEGURIDAD - Validación de Entrada

**Problema:** Sin validación de datos

**Solución:**
```bash
npm install express-validator
```

```javascript
const { body, validationResult } = require('express-validator');

// Validación para login
app.post('/api/login',
    body('username').trim().isLength({ min: 3, max: 50 }).escape(),
    body('password').isLength({ min: 6 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // ... resto del código
    }
);

// Validación para productos
app.post('/api/products',
    authenticateToken,
    body('name').trim().isLength({ min: 1, max: 100 }).escape(),
    body('price').isFloat({ min: 0.01 }),
    body('img').optional().trim().escape(),
    async (req, res) => {
        // ...
    }
);
```

### 5. SEGURIDAD - Rate Limiting

**Problema:** Sin protección contra ataques de fuerza bruta

**Solución:**
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// Rate limiter para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos
    message: 'Demasiados intentos de login, intenta en 15 minutos'
});

// Rate limiter general
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});

app.post('/api/login', loginLimiter, async (req, res) => {
    // ...
});

app.use('/api/', apiLimiter);
```

---

## 🟠 PRIORIDAD ALTA (Implementar en 1-2 semanas)

### 6. ARQUITECTURA - Separación de Capas

**Problema:** Código monolítico

**Solución:** Estructura MVC

```
hotdogs/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── environment.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   └── ticketController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Order.js
│   │   └── Ticket.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── orderRoutes.js
│   │   └── ticketRoutes.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── productService.js
│   │   └── orderService.js
│   └── utils/
│       ├── logger.js
│       └── helpers.js
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── tests/
├── .env
├── .env.example
├── .gitignore
└── server.js
```

**Ejemplo de Controller:**
```javascript
// src/controllers/productController.js
const productService = require('../services/productService');
const { validationResult } = require('express-validator');

exports.getAllProducts = async (req, res, next) => {
    try {
        const products = await productService.getAllProducts();
        res.json(products);
    } catch (error) {
        next(error);
    }
};

exports.createProduct = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const product = await productService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};
```

### 7. MANEJO DE ERRORES Centralizado

**Problema:** Errores manejados inconsistentemente

**Solución:**
```javascript
// src/middleware/errorHandler.js
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // Producción: no exponer detalles
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } else {
            console.error('ERROR 💥', err);
            res.status(500).json({
                status: 'error',
                message: 'Algo salió mal'
            });
        }
    }
};

module.exports = { AppError, errorHandler };
```

### 8. LOGGING Estructurado

**Problema:** Solo console.log

**Solución:**
```bash
npm install winston
```

```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;
```

### 9. BASE DE DATOS - Migraciones

**Problema:** Sin control de versiones de BD

**Solución:**
```bash
npm install knex
npx knex init
```

```javascript
// migrations/20240101_create_users.js
exports.up = function(knex) {
    return knex.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('username', 50).unique().notNullable();
        table.string('password', 255).notNullable();
        table.enum('role', ['admin', 'caja', 'empleado']).notNullable();
        table.timestamps(true, true);
        table.index('username');
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('users');
};
```

### 10. FRONTEND - Refactorización de script.js

**Problema:** 1000+ líneas en un archivo

**Solución:** Modularizar

```javascript
// public/js/modules/auth.js
export class AuthManager {
    constructor(api) {
        this.api = api;
        this.currentUser = null;
    }
    
    async login(username, password) {
        try {
            const response = await this.api.login(username, password);
            this.currentUser = response.user;
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            return response;
        } catch (error) {
            throw new Error(error.message);
        }
    }
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    
    isAuthenticated() {
        return !!this.currentUser;
    }
}

// public/js/modules/cart.js
export class CartManager {
    constructor() {
        this.items = [];
        this.total = 0;
    }
    
    addItem(product, quantity = 1, customizations = []) {
        const item = {
            ...product,
            quantity,
            customizations,
            subtotal: product.price * quantity
        };
        this.items.push(item);
        this.updateTotal();
        this.render();
    }
    
    removeItem(index) {
        this.items.splice(index, 1);
        this.updateTotal();
        this.render();
    }
    
    updateTotal() {
        this.total = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    }
    
    clear() {
        this.items = [];
        this.total = 0;
        this.render();
    }
    
    render() {
        // Actualizar DOM
    }
}

// public/js/app.js
import { AuthManager } from './modules/auth.js';
import { CartManager } from './modules/cart.js';
import { ProductManager } from './modules/products.js';
import { OrderManager } from './modules/orders.js';

class App {
    constructor() {
        this.auth = new AuthManager(api);
        this.cart = new CartManager();
        this.products = new ProductManager(api);
        this.orders = new OrderManager(api);
        this.init();
    }
    
    async init() {
        // Verificar si hay sesión activa
        const token = localStorage.getItem('token');
        if (token) {
            // Validar token y restaurar sesión
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Event listeners globales
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
```

---

## 🟡 PRIORIDAD MEDIA (Implementar en 1 mes)

### 11. TESTING

**Solución:**
```bash
npm install --save-dev jest supertest
```

```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../server');

describe('Auth API', () => {
    test('POST /api/login - success', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ username: 'admin', password: 'admin123' });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('username', 'admin');
    });
    
    test('POST /api/login - invalid credentials', async () => {
        const response = await request(app)
            .post('/api/login')
            .send({ username: 'admin', password: 'wrong' });
        
        expect(response.status).toBe(401);
    });
});
```

### 12. DOCUMENTACIÓN API

**Solución:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

```javascript
// swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hot Dogs POS API',
            version: '1.0.0',
            description: 'API para sistema POS de Hot Dogs'
        },
        servers: [
            { url: 'http://localhost:3000', description: 'Desarrollo' },
            { url: 'https://tu-app.onrender.com', description: 'Producción' }
        ]
    },
    apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);

// En server.js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 13. CACHÉ

**Solución:**
```bash
npm install node-cache
```

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos

// Middleware de caché
const cacheMiddleware = (duration) => (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
        return res.json(cachedResponse);
    }
    
    res.originalJson = res.json;
    res.json = (body) => {
        cache.set(key, body, duration);
        res.originalJson(body);
    };
    next();
};

// Usar en rutas
app.get('/api/products', cacheMiddleware(600), async (req, res) => {
    // ...
});
```

### 14. PAGINACIÓN

**Problema:** Cargar todos los registros

**Solución:**
```javascript
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const orders = await dbQuery(
            'SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );
        
        const total = await dbGet('SELECT COUNT(*) as count FROM orders');
        
        res.json({
            data: orders,
            pagination: {
                page,
                limit,
                total: total.count,
                pages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});
```

### 15. BÚSQUEDA AVANZADA

**Solución:**
```javascript
app.get('/api/products/search', async (req, res) => {
    try {
        const { q, minPrice, maxPrice, sortBy } = req.query;
        
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        
        if (q) {
            query += ' AND name LIKE ?';
            params.push(`%${q}%`);
        }
        
        if (minPrice) {
            query += ' AND price >= ?';
            params.push(parseFloat(minPrice));
        }
        
        if (maxPrice) {
            query += ' AND price <= ?';
            params.push(parseFloat(maxPrice));
        }
        
        if (sortBy === 'price_asc') {
            query += ' ORDER BY price ASC';
        } else if (sortBy === 'price_desc') {
            query += ' ORDER BY price DESC';
        } else {
            query += ' ORDER BY name ASC';
        }
        
        const products = await dbQuery(query, params);
        res.json(products);
    } catch (error) {
        next(error);
    }
});
```

---

## 🟢 PRIORIDAD BAJA (Mejoras futuras)

### 16. PWA (Progressive Web App)

```javascript
// public/sw.js - Service Worker
const CACHE_NAME = 'hotdogs-pos-v1';
const urlsToCache = [
    '/',
    '/styles.css',
    '/script.js',
    '/api.js',
    '/logo-hotdogs.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
```

```json
// public/manifest.json
{
    "name": "Hot Dogs POS",
    "short_name": "POS",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#FF6B35",
    "theme_color": "#FF6B35",
    "icons": [
        {
            "src": "/logo-hotdogs.png",
            "sizes": "192x192",
            "type": "image/png"
        }
    ]
}
```

### 17. SISTEMA DE INVENTARIO

```javascript
// Agregar a tabla products
ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5;

// Endpoint para alertas de stock bajo
app.get('/api/inventory/alerts', authenticateToken, async (req, res) => {
    const lowStock = await dbQuery(
        'SELECT * FROM products WHERE stock <= min_stock'
    );
    res.json(lowStock);
});

// Actualizar stock al crear pedido
app.post('/api/orders', authenticateToken, async (req, res) => {
    // ... código existente
    
    // Reducir stock
    for (const item of items) {
        await dbRun(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.quantity, item.id]
        );
    }
});
```

### 18. EXPORTACIÓN DE REPORTES

```bash
npm install exceljs pdfkit
```

```javascript
const ExcelJS = require('exceljs');

app.get('/api/reports/export/excel', authenticateToken, async (req, res) => {
    const orders = await dbQuery('SELECT * FROM orders');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pedidos');
    
    worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Empleado', key: 'employee', width: 20 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Estado', key: 'status', width: 15 },
        { header: 'Fecha', key: 'created_at', width: 20 }
    ];
    
    worksheet.addRows(orders);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=pedidos.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
});
```

### 19. NOTIFICACIONES PUSH

```bash
npm install web-push
```

```javascript
const webpush = require('web-push');

// Configurar VAPID keys
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
    'mailto:tu-email@ejemplo.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Enviar notificación
app.post('/api/notifications/send', authenticateToken, async (req, res) => {
    const { subscription, payload } = req.body;
    
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### 20. DESCUENTOS Y PROMOCIONES

```sql
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(20), -- 'percentage', 'fixed', 'bogo'
    value DECIMAL(10,2),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    active BOOLEAN DEFAULT true
);

CREATE TABLE order_promotions (
    order_id INTEGER REFERENCES orders(id),
    promotion_id INTEGER REFERENCES promotions(id),
    discount_amount DECIMAL(10,2)
);
```

---

## 📊 MÉTRICAS Y MONITOREO

### 21. Implementar Monitoreo

```bash
npm install @sentry/node
```

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## 🔧 HERRAMIENTAS DE DESARROLLO

### 22. Configurar ESLint y Prettier

```bash
npm install --save-dev eslint prettier eslint-config-prettier
```

```json
// .eslintrc.json
{
    "env": {
        "node": true,
        "es2021": true
    },
    "extends": ["eslint:recommended", "prettier"],
    "parserOptions": {
        "ecmaVersion": 12
    },
    "rules": {
        "no-console": "warn",
        "no-unused-vars": "warn"
    }
}
```

```json
// .prettierrc
{
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 100,
    "tabWidth": 4
}
```

### 23. Husky para Git Hooks

```bash
npm install --save-dev husky lint-staged
npx husky install
```

```json
// package.json
{
    "lint-staged": {
        "*.js": ["eslint --fix", "prettier --write"]
    },
    "scripts": {
        "prepare": "husky install"
    }
}
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### Fase 1 - Seguridad (1 semana)
- [ ] Implementar bcrypt para contraseñas
- [ ] Agregar JWT para autenticación
- [ ] Crear archivo .env y .env.example
- [ ] Implementar validación de entrada
- [ ] Agregar rate limiting
- [ ] Actualizar .gitignore

### Fase 2 - Arquitectura (2 semanas)
- [ ] Refactorizar a estructura MVC
- [ ] Implementar manejo de errores centralizado
- [ ] Agregar logging con Winston
- [ ] Crear migraciones de base de datos
- [ ] Separar configuración

### Fase 3 - Frontend (1 semana)
- [ ] Modularizar script.js
- [ ] Implementar gestión de estado
- [ ] Mejorar manejo de errores
- [ ] Agregar validación de formularios

### Fase 4 - Testing y Documentación (1 semana)
- [ ] Escribir tests unitarios
- [ ] Escribir tests de integración
- [ ] Documentar API con Swagger
- [ ] Crear README completo

### Fase 5 - Optimización (1 semana)
- [ ] Implementar caché
- [ ] Agregar paginación
- [ ] Optimizar consultas SQL
- [ ] Comprimir respuestas

### Fase 6 - Funcionalidades Avanzadas (2-4 semanas)
- [ ] Sistema de inventario
- [ ] Exportación de reportes
- [ ] PWA
- [ ] Notificaciones push
- [ ] Descuentos y promociones

---

## 🚀 COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev

# Producción
npm start

# Tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Base de datos
npm run migrate
npm run migrate:rollback
npm run seed

# Build
npm run build
```

---

## 📚 RECURSOS RECOMENDADOS

### Libros
- "Node.js Design Patterns" - Mario Casciaro
- "Clean Code" - Robert C. Martin
- "The Pragmatic Programmer" - Hunt & Thomas

### Cursos
- Node.js - The Complete Guide (Udemy)
- Testing JavaScript (testingjavascript.com)
- JavaScript: The Hard Parts (Frontend Masters)

### Documentación
- Express.js Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Node.js Security Checklist: https://blog.risingstack.com/node-js-security-
