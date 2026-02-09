// Cliente API para comunicación con el backend
class API {
    constructor(baseURL) {
        // Detectar automáticamente la URL correcta
        if (!baseURL) {
            const hostname = window.location.hostname;
            
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                // Estamos en la computadora (desarrollo local)
                baseURL = 'http://localhost:3000';
            } else if (hostname.includes('onrender.com')) {
                // Estamos en Render (producción)
                baseURL = window.location.origin; // Usa la misma URL del sitio
            } else if (hostname.includes('192.168.')) {
                // Estamos en la red local (celular conectado a la misma WiFi)
                baseURL = 'http://192.168.101.53:3000';
            } else {
                // Por defecto, usar la URL actual del sitio
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
        localStorage.removeItem('currentUser');
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
                    if (window.location.pathname !== '/') {
                        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
                        window.location.href = '/';
                    }
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
    async getOrders() {
        return this.request('/api/orders');
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
            body: JSON.stringify({ order_id, employee, items, total, amount_received, change_given, payment_method })
        });
    }
}

// Exportar instancia única de la API
const api = new API();
