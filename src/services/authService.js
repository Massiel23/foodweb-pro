const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
    constructor(dbGet, dbRun) {
        this.dbGet = dbGet;
        this.dbRun = dbRun;
    }

    async login(username, password) {
        // Buscar usuario
        const user = await this.dbGet(
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
        const existingUser = await this.dbGet(
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
        const result = await this.dbRun(
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
        const user = await this.dbGet(
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
        await this.dbRun(
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

module.exports = AuthService;
