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
        .isLength({ min: 3 })
        .withMessage('La contraseña debe tener al menos 3 caracteres'),
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
        .isLength({ min: 3 })
        .withMessage('La contraseña debe tener al menos 3 caracteres'),
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

// Validadores para pedidos (más permisivos para compatibilidad)
const orderValidators = [
    body('employee')
        .optional()
        .trim(),
    body('items')
        .optional()
        .custom((value) => {
            // Permitir tanto arrays como strings JSON
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return true;
                } catch (e) {
                    throw new Error('Items debe ser un array válido o JSON string');
                }
            }
            if (Array.isArray(value)) {
                return true;
            }
            throw new Error('Items debe ser un array o JSON string');
        }),
    body('total')
        .optional()
        .custom((value) => {
            const num = parseFloat(value);
            if (isNaN(num) || num < 0) {
                throw new Error('Total debe ser un número válido mayor o igual a 0');
            }
            return true;
        }),
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

module.exports = {
    loginValidators,
    registerValidators,
    productValidators,
    orderValidators,
    ticketValidators,
    idParamValidator,
    handleValidationErrors
};
