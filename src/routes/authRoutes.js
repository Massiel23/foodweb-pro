const express = require('express');
const router = express.Router();
const { loginValidators, registerValidators } = require('../middleware/validators');
const { loginLimiter, authenticateToken, authorizeRoles } = require('../middleware/security');

module.exports = (authService, io, verifyRecaptcha) => {
    /**
     * @route   POST /api/auth/login
     * @desc    Iniciar sesión
     * @access  Public
     */
    router.post('/login', loginLimiter, loginValidators, async (req, res, next) => {
        try {
            const { username, password, recaptchaToken } = req.body;

            // Validar reCAPTCHA si el helper está disponible (v3)
            if (verifyRecaptcha) {
                const isHuman = await verifyRecaptcha(recaptchaToken);
                if (!isHuman) return res.status(403).json({ error: 'Fallo de seguridad reCAPTCHA. Intenta de nuevo.' });
            }

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

                // Emitir evento de nuevo usuario
                io.emit('userAdded', user);

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
     * @desc    Cerrar sesión
     * @access  Private
     */
    router.post('/logout', authenticateToken, (req, res) => {
        res.json({ message: 'Sesión cerrada exitosamente' });
    });

    return router;
};
