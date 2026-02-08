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
        console.log('🌐 API conectada a:', this.baseURL);
    }

    // Método genérico para hacer peticiones
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Error en la petición');
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en ${endpoint}:`, error);
            throw error;
        }
    }

    // ========== USUARIOS ==========
    async getUsers() {
        return this.request('/api/users');
    }

    async addUser(username, password, role) {
        return this.request('/api/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role })
        });
    }

    async deleteUser(id) {
        return this.request(`/api/users/${id}`, {
            method: 'DELETE'
        });
    }

    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
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
