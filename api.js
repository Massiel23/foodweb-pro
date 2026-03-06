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
        this.restaurantId = localStorage.getItem('restaurantId');
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
        if (this.restaurantId) {
            headers['x-restaurant-id'] = this.restaurantId;
        }

        return headers;
    }

    // Guardar autenticación
    setAuthDetails(token, restaurantId) {
        if (token) {
            this.token = token;
            localStorage.setItem('token', token);
        }
        if (restaurantId) {
            this.restaurantId = restaurantId;
            localStorage.setItem('restaurantId', restaurantId);
        }
    }

    // Eliminar sesión completa
    clearToken() {
        this.token = null;
        this.restaurantId = null;
        localStorage.removeItem('token');
        localStorage.removeItem('restaurantId');
        localStorage.removeItem('activeBranchId');
        localStorage.removeItem('activeBranchName');
        localStorage.removeItem('lastUsername');
        localStorage.removeItem('currentUser');
    }

    // Método genérico para hacer peticiones
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: this.getHeaders(),
                ...options
            });

            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            }

            if (!response.ok) {
                // Si el token expiró o hay error 401
                if (response.status === 401 || response.status === 403) {
                    this.clearToken();
                    if (window.location.pathname !== '/') {
                        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
                        window.location.href = '/';
                    }
                }
                throw new Error((data && data.error) ? data.error : `Error HTTP: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`Error en ${endpoint}:`, error);
            throw error;
        }
    }

    // ========== MODO SAAS (Multi-Tenant) ==========
    async registerRestaurant(restaurantName, email, fullName, password, plan) {
        const response = await this.request('/api/restaurants/register', {
            method: 'POST',
            body: JSON.stringify({ restaurantName, email, fullName, password, plan })
        });

        if (response.restaurantId) {
            this.setAuthDetails('dummy-token', response.restaurantId);
        }

        return response;
    }

    async createBranch(name) {
        return this.request('/api/restaurants/branch', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    }

    async updateRestaurantPlan(plan) {
        return this.request('/api/restaurants/plan', {
            method: 'PUT',
            body: JSON.stringify({ plan })
        });
    }

    // ========== PERFIL Y SEGURIDAD ==========
    async getProfile(userId) {
        return this.request(`/api/profile?userId=${userId}`);
    }

    async updateProfile(userId, fullName, email, restaurantName) {
        return this.request(`/api/profile?userId=${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ fullName, email, restaurantName })
        });
    }

    async forgotPassword(email) {
        return this.request('/api/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async resetPassword(email, newPassword) {
        return this.request('/api/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, newPassword })
        });
    }

    // ========== AUTENTICACIÓN ==========
    async login(username, password) {
        const response = await this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        // Guardar token y restaurant_id
        if (response) {
            // El backend por ahora no devuelve JWT real, pero seteamos restaurant_id
            this.setAuthDetails('dummy-token', response.restaurant_id);
        }

        return { user: response, token: 'dummy-token' }; // Compatibilidad con el frontend actual
    }

    async logout() {
        this.clearToken();
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

    // ========== PRODUCTOS ==========
    async getProducts() {
        return this.request('/api/products');
    }

    async addProduct(name, price, img, modifiers = []) {
        return this.request('/api/products', {
            method: 'POST',
            body: JSON.stringify({ name, price, img, modifiers })
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

    async createOrder(employee, items, total, status = 'Pendiente', table_name = null) {
        return this.request('/api/orders', {
            method: 'POST',
            body: JSON.stringify({ employee, items, total, status, table_name })
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

    // ========== MESAS ==========
    async getTables() {
        return this.request('/api/tables');
    }

    async addTable(name, assigned_user_id = null) {
        return this.request('/api/tables', {
            method: 'POST',
            body: JSON.stringify({ name, assigned_user_id })
        });
    }

    async deleteTable(id) {
        return this.request(`/api/tables/${id}`, {
            method: 'DELETE'
        });
    }

    async updateTable(id, assigned_user_id) {
        return this.request(`/api/tables/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ assigned_user_id })
        });
    }
}

// Exportar instancia única de la API
const posApi = new API();
