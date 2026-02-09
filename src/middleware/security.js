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
            scriptSrcAttr: ["'unsafe-inline'"], // Permitir event handlers inline (onclick, etc.)
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.socket.io"], // Permitir Socket.IO CDN
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
