// Estado global
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let currentRestaurantPlan = 'basico'; // Por defecto
let categories = [];
let products = [];
let cart = [];
let currentOrder = null;
let printedTickets = [];
let socket = null;
let employeeHistoryFilter = 'all';
let newProductModifiers = [];
let total = 0;
let taxRate = 10;
let pendingOrders = [];

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar Socket.IO
    initializeSocket();

    // Cargar configuración desde localStorage
    const savedTaxRate = localStorage.getItem('taxRate');
    if (savedTaxRate) {
        taxRate = parseFloat(savedTaxRate);
        const taxInput = document.getElementById('tax-rate');
        if (taxInput) taxInput.value = taxRate;
    }

    // Verificar si ya hay una sesión activa
    await checkAutoLogin();

    // Cargar Tema
    checkSavedTheme();
});

async function checkAutoLogin() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            console.log('🔄 Sesión detectada para:', currentUser.username);

            // Si hay un restaurantId en localStorage pero no coincide con el del usuario
            // (sucede al cambiar de sucursal), priorizamos el de localStorage
            const savedResId = localStorage.getItem('restaurantId');
            if (savedResId) {
                const newId = parseInt(savedResId);
                // Re-unirse al socket si el ID cambió o para asegurar persistencia
                if (socket) {
                    socket.emit('joinRestaurant', newId);
                }
                currentUser.restaurant_id = newId;
                posApi.restaurantId = savedResId;
            }

            await applyUserPermissions(currentUser);

            // Cargar datos iniciales
            await loadProducts();
            await loadOrders();

            showNotification(`Bienvenido de nuevo, ${currentUser.username}`);
        } catch (e) {
            console.error('Error en auto-login:', e);
            logout();
        }
    }
}

// ========== SOCKET.IO ==========
function initializeSocket() {
    // Detectar automáticamente la URL correcta para Socket.IO
    let socketURL;
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Estamos en la computadora (desarrollo local)
        socketURL = 'http://localhost:3000';
    } else if (hostname.includes('onrender.com')) {
        // Estamos en Render (producción)
        socketURL = window.location.origin; // Usa la misma URL del sitio
    } else if (hostname.includes('192.168.')) {
        // Estamos en la red local (celular conectado a la misma WiFi)
        socketURL = 'http://192.168.101.53:3000';
    } else {
        // Por defecto, usar la URL actual del sitio
        socketURL = window.location.origin;
    }

    console.log('🔌 Conectando Socket.IO a:', socketURL);
    socket = io(socketURL);

    socket.on('connect', () => {
        console.log('✅ Conectado al servidor Socket.IO');
        // Unirse a la sala si hay un usuario logueado en caché
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                if (parsed.restaurant_id) {
                    socket.emit('joinRestaurant', parsed.restaurant_id);
                }
            } catch (e) { }
        }
    });

    socket.on('disconnect', () => {
        console.log('Desconectado del servidor');
    });

    // Escuchar nuevos pedidos
    socket.on('newOrder', (order) => {
        console.log('Nuevo pedido recibido:', order);
        loadOrders();
        showNotification('Nuevo pedido recibido');
    });

    // Escuchar actualizaciones de pedidos
    socket.on('orderUpdated', (data) => {
        console.log('Pedido actualizado:', data);
        loadOrders();

        // Notificar al empleado si su pedido está listo
        if (currentUser && currentUser.role === 'empleado' && data.status === 'Finalizado') {
            // Verificar si el pedido es del empleado actual
            const order = pendingOrders.find(o => o.id === data.id);
            if (order && order.username === currentUser.username) {
                showNotification(`🎉 ¡Tu pedido #${data.id} está LISTO para entregar!`);
                // Reproducir sonido de notificación (opcional)
                playNotificationSound();
            }
        } else {
            showNotification(`Pedido #${data.id} actualizado a: ${data.status}`);
        }
    });

    // Escuchar nuevos productos
    socket.on('productAdded', (product) => {
        console.log('Nuevo producto agregado:', product);
        loadProducts();
    });

    // Escuchar productos eliminados
    socket.on('productDeleted', (data) => {
        console.log('Producto eliminado:', data);
        loadProducts();
    });

    // Escuchar nuevos usuarios
    socket.on('userAdded', (user) => {
        console.log('Nuevo usuario agregado:', user);
        if (currentUser && currentUser.role === 'admin') {
            renderEmployees();
        }
    });

    // Escuchar tickets impresos
    socket.on('ticketPrinted', (ticket) => {
        console.log('Ticket impreso:', ticket);
        loadTickets();
    });

    // Iniciar el cronómetro global de cocina
    if (!window.kitchenTimerInterval) {
        window.kitchenTimerInterval = setInterval(() => {
            updateCountdownLabels();
        }, 1000); // Cada segundo para cronómetro real
    }
}

function formatCountdown(seconds) {
    if (seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateCountdownLabels() {
    const labels = document.querySelectorAll('.countdown-badge');
    labels.forEach(label => {
        const orderId = parseInt(label.getAttribute('data-order-id'));
        const order = pendingOrders.find(o => o.id === orderId);
        if (order) {
            const times = calculateOrderTimes(orderId);
            if (order.status === 'Pendiente') {
                label.textContent = `⏳ EN ESPERA - ~${formatCountdown(times.startInSeconds)}`;
            } else if (order.status === 'En Preparación') {
                label.textContent = `🔥 PREPARANDO - ~${formatCountdown(times.readyInSeconds)}`;
            }
        }
    });

    // Actualizar también las tarjetas del mesero
    const employeeLabels = document.querySelectorAll('.employee-countdown-badge');
    employeeLabels.forEach(label => {
        const orderId = parseInt(label.getAttribute('data-order-id'));
        const order = pendingOrders.find(o => o.id === orderId);
        if (order) {
            const times = calculateOrderTimes(orderId);
            if (order.status === 'Pendiente') {
                label.innerHTML = `⏳ ${formatCountdown(times.startInSeconds)}`;
            } else if (order.status === 'En Preparación') {
                label.innerHTML = `🔥 ${formatCountdown(times.readyInSeconds)}`;
            }
        }
    });
}

// ========== NOTIFICACIONES ==========
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${document.body.classList.contains('dark-mode') ? 'var(--header-bg)' : '#4CAF50'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== TEMA (MODO OSCURO) ==========
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Actualizar icono del botón
    const btn = document.querySelector('.dark-mode-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';

    showNotification(isDark ? 'Modo Oscuro Activado' : 'Modo Claro Activado');

    // Regenerar reportes si estamos en la pestaña de reportes para actualizar gráficos
    if (document.getElementById('tab-reportes').style.display !== 'none') {
        generateReports(document.querySelector('.filter-btn.active')?.getAttribute('onclick').match(/'([^']+)'/)[1] || 'all');
    }
}

function checkSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.querySelector('.dark-mode-toggle');
        if (btn) btn.textContent = '☀️';
    }
}

// ========== AUTENTICACIÓN Y SAAS (PAYWALL) ==========
let selectedPlan = null;
let pendingRegistration = null;

function showPricingForm() {
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('payment-container').style.display = 'none';
    document.getElementById('pricing-container').style.display = 'block';
    document.getElementById('login-msg').textContent = '';
}

function showLoginForm() {
    document.getElementById('pricing-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('payment-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';
    selectedPlan = null;
    document.getElementById('login-msg').textContent = '';
}

function showForgotPassword() {
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('forgot-password-container').style.display = 'block';
}

async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return alert('Por favor ingresa tu correo electrónico');
    try {
        const res = await posApi.forgotPassword(email);
        alert(res.message);
        showLoginForm();
    } catch (e) {
        alert(e.message);
    }
}

function toggleRegisterForm() {
    // Redirigir al inicio del flujo transaccional (Precios)
    showPricingForm();
}

function selectPlan(planType) {
    selectedPlan = planType;
    document.getElementById('pricing-container').style.display = 'none';

    // Actualizar Badge visual
    const badge = document.getElementById('selected-plan-badge');
    if (planType === 'Basico') {
        badge.innerHTML = 'Plan Básico ($260 MXN/mes)';
        badge.style.color = 'var(--text-secondary)';
    } else {
        badge.innerHTML = 'Plan Pro ($499 MXN/mes)';
        badge.style.color = 'var(--primary-color)';
    }

    document.getElementById('register-form-container').style.display = 'block';
}

async function handleRegister() {
    const name = document.getElementById('reg-restaurant').value.trim();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value.trim();
    const loginMsg = document.getElementById('login-msg');
    loginMsg.textContent = '';

    if (!name || !fullName || !email || !pass) {
        loginMsg.textContent = 'Por favor completa todos los campos.';
        return;
    }

    if (!selectedPlan) {
        loginMsg.textContent = 'Por favor selecciona un plan primero.';
        return;
    }

    try {
        // Registrar en backend pre-pago
        const response = await posApi.registerRestaurant(name, email, fullName, pass, selectedPlan);

        // Guardar temporalmente para auto-login tras el pago
        // El backend genera un username automático, lo guardamos para el login final
        pendingRegistration = { username: response.username, password: pass };

        // Mostrar contenedor de pago
        document.getElementById('register-form-container').style.display = 'none';
        document.getElementById('pay-rest-name').textContent = name;
        document.getElementById('payment-container').style.display = 'block';

        // Renderizar botones de PayPal reales
        renderPayPalButtons();

    } catch (error) {
        loginMsg.textContent = error.message || 'Error al crear el restaurante.';
    }
}

function renderPayPalButtons() {
    const container = document.getElementById('paypal-button-container');
    container.innerHTML = ''; // Limpiar previo

    const planId = selectedPlan === 'Basico'
        ? 'P-3D508941XX4410022NGSINVY'
        : 'P-1YS68428Y6663370UNGSILUY';

    paypal.Buttons({
        style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
        },
        createSubscription: function (data, actions) {
            return actions.subscription.create({
                'plan_id': planId
            });
        },
        onApprove: function (data, actions) {
            console.log('Suscripción aprobada:', data.subscriptionID);
            handlePaymentSuccess(data.subscriptionID);
        },
        onError: function (err) {
            console.error('Error en PayPal:', err);
            document.getElementById('login-msg').textContent = 'Hubo un error al procesar el pago con PayPal.';
        }
    }).render('#paypal-button-container');
}

async function handlePaymentSuccess(subscriptionID) {
    if (!pendingRegistration) return;

    showNotification(`¡Suscripción activa! ID: ${subscriptionID}`);

    // Proceder con login automático
    document.getElementById('username').value = pendingRegistration.username;
    document.getElementById('password').value = pendingRegistration.password;

    pendingRegistration = null;
    selectedPlan = null;

    document.getElementById('payment-container').style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';

    await login();
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginMsg = document.getElementById('login-msg');

    loginMsg.textContent = '';

    if (!username || !password) {
        loginMsg.textContent = 'Por favor, ingresa usuario y contraseña.';
        return;
    }

    try {
        const response = await posApi.login(username, password);

        // Priorizar la sucursal cacheada localmente si existe antes de guardar a currentUser
        const savedResId = localStorage.getItem('restaurantId');
        if (savedResId) {
            response.user.restaurant_id = parseInt(savedResId);
            posApi.restaurantId = parseInt(savedResId);
            // También se unen al nuevo id por si acaso
            if (socket) {
                socket.emit('joinRestaurant', parseInt(savedResId));
            }
        }

        currentUser = response.user;
        localStorage.setItem('currentUser', JSON.stringify(response.user));

        await applyUserPermissions(response.user);

        await loadProducts();
        await loadOrders();

        showNotification(`Bienvenido, ${response.user.username}!`);
    } catch (error) {
        loginMsg.textContent = error.message || 'Usuario o contraseña incorrectos.';
    }
}

async function applyUserPermissions(user) {
    if (!user) return;

    // Actualizar UI básica
    if (user.restaurant_name) {
        document.getElementById('header-restaurant-name').textContent = user.restaurant_name.toUpperCase();
        document.title = user.restaurant_name + " - POS";
    }

    // Ocultar login y mostrar app
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    // Reset de Navs
    document.getElementById('nav-admin').style.display = 'none';
    document.getElementById('nav-caja').style.display = 'none';
    document.getElementById('nav-empleado').style.display = 'none';
    document.getElementById('nav-cocina').style.display = 'none';

    // Mostrar Nav según rol
    if (user.role === 'admin') {
        document.getElementById('nav-admin').style.display = 'block';
    } else if (user.role === 'caja') {
        document.getElementById('nav-caja').style.display = 'block';
    } else if (user.role === 'cocinero') {
        document.getElementById('nav-cocina').style.display = 'block';
    } else {
        document.getElementById('nav-empleado').style.display = 'block';
    }

    // Sección por defecto y restricción de navegación
    if (user.role === 'caja') {
        showSection('pendientes-cobrar');
    } else if (user.role === 'empleado') {
        showSection('venta');
    } else if (user.role === 'cocinero') {
        showSection('cocina');
        loadKitchenOrders();
    } else {
        showSection('venta');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    posApi.logout(); // Limpia localStorage del posApi.js

    document.getElementById('app').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('nav-admin').style.display = 'none';
    document.getElementById('nav-empleado').style.display = 'none';
    document.getElementById('nav-caja').style.display = 'none';
    document.getElementById('nav-cocina').style.display = 'none';

    // Limpiar campos de login
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';

    document.getElementById('header-restaurant-name').textContent = 'FOODWEB POS';
    document.title = 'POS -FoodWeb Pro';

    cart = [];
    total = 0;
    updateCart();
}

// ========== NAVEGACIÓN Y HISTORY API ==========
window.addEventListener('popstate', (event) => {
    // Si hay un estado guardado en el historial, navegamos a él sin volver a empujar al historial
    if (event.state && event.state.sectionId) {
        showSection(event.state.sectionId, false);
    } else {
        // Fallback al inicio según el rol si no hay estado previo
        if (currentUser) {
            if (currentUser.role === 'caja') showSection('pendientes-cobrar', false);
            else if (currentUser.role === 'cocinero') showSection('cocina', false);
            else showSection('venta', false);
        }
    }
});

async function showSection(sectionId, pushState = true) {
    const adminSections = ['productos', 'empleados', 'pedidos', 'ajustes', 'facturacion', 'reportes'];
    const cajaSections = ['pendientes-cobrar', 'cobrados', 'tickets'];

    // Admin tiene acceso a TODO
    if (currentUser.role === 'admin') {
        // Admin puede acceder a cualquier sección, no hay restricciones
    } else if (currentUser.role === 'caja') {
        // Caja solo puede acceder a secciones de caja
        if (adminSections.includes(sectionId) && sectionId !== 'venta') {
            alert('Acceso denegado.');
            return;
        }
    } else if (currentUser.role === 'empleado') {
        // Empleado no puede acceder a secciones de admin ni caja
        if (adminSections.includes(sectionId) || cajaSections.includes(sectionId)) {
            alert('Acceso denegado.');
            return;
        }
    }

    // Ocultar sección anterior y remover clase active de los botones
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-nav'));

    // Mostrar sección actual
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        // Buscar botón de navegación y activarlo
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('onclick')?.includes(`'${sectionId}'`));
        if (btn) btn.classList.add('active-nav');
    }

    // Push State para el botón "Atrás" del navegador/móvil
    if (pushState) {
        // Solo empujar si es diferente al estado actual para no llenar de duplicados el historial
        const currentState = history.state;
        if (!currentState || currentState.sectionId !== sectionId) {
            history.pushState({ sectionId: sectionId }, '', `#${sectionId}`);
        }
    }

    if (sectionId === 'venta' || sectionId === 'productos') {
        renderProducts();
    }
    if (sectionId === 'pedidos') {
        renderPendingOrders();
    }
    if (sectionId === 'empleados') {
        renderEmployees();
    }
    if (sectionId === 'pendientes-cobrar') {
        renderCashierPendingOrders();
    }
    if (sectionId === 'cobrados') {
        renderCashierPaidOrders();
    }
    if (sectionId === 'tickets') {
        loadTickets();
    }
    if (sectionId === 'reportes') {
        generateReports();
    }
    if (sectionId === 'mis-pedidos') {
        renderEmployeePendingOrders();
    }
    if (sectionId === 'historial-pedidos') {
        renderEmployeeOrderHistory('all');
    }
    if (sectionId === 'perfil') {
        await showProfile();
        showProfileTab('datos'); // Default tab
    }
}

async function showProfile() {
    if (!currentUser) return;
    try {
        console.log('📡 Fetching profile for user:', currentUser.id);
        const { user, restaurant, branches } = await posApi.getProfile(currentUser.id);

        if (!restaurant) throw new Error('Restaurante no encontrado');

        // Guardar sucursales globalmente
        window.myBranches = branches || [];
        currentRestaurantPlan = (restaurant.plan || 'Basico').toLowerCase();

        console.log('✅ Perfil cargado:', { plan: currentRestaurantPlan, branch: restaurant.name });

        document.getElementById('profile-name-display').textContent = user.full_name || 'Sin Nombre';
        document.getElementById('profile-username-display').textContent = '@' + user.username;
        document.getElementById('profile-fullname').value = user.full_name || '';
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-restaurant-name').value = restaurant.name || '';
        document.getElementById('profile-branch-display').textContent = restaurant.name || 'Sucursal';

        // Mostrar Plan
        const isPro = currentRestaurantPlan === 'pro';

        const planInput = document.getElementById('profile-plan-name');
        const planBadge = document.getElementById('profile-plan-badge');

        if (planInput) planInput.value = isPro ? 'Plan Pro ($499 MXN/mes)' : 'Plan Básico ($260 MXN/mes)';
        if (planBadge) {
            planBadge.textContent = isPro ? 'PLAN PRO' : 'PLAN BÁSICO';
            planBadge.style.background = isPro ? 'rgba(99, 102, 241, 0.1)' : 'rgba(100, 116, 139, 0.1)';
            planBadge.style.color = isPro ? 'var(--primary-color)' : 'var(--text-secondary)';
        }

        // Iniciales
        const names = (user.full_name || user.username).split(' ');
        const initials = names.length > 1 ? (names[0][0] + (names[1] ? names[1][0] : '')) : names[0].substring(0, 2);
        document.getElementById('profile-initials').textContent = initials.toUpperCase();

    } catch (e) {
        console.error('❌ Error en showProfile:', e);
        showNotification('Error al cargar datos del perfil');
    }
}

async function updateUserProfile() {
    const fullName = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const restaurantName = document.getElementById('profile-restaurant-name').value.trim();

    try {
        await posApi.updateProfile(currentUser.id, fullName, email, restaurantName);
        showNotification('✅ Perfil actualizado correctamente');

        // Actualizar datos locales
        currentUser.full_name = fullName;
        currentUser.email = email;
        currentUser.restaurant_name = restaurantName;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Actualizar UI inmediata
        document.getElementById('header-restaurant-name').textContent = restaurantName.toUpperCase();
        showProfile();
    } catch (e) {
        alert('Error al actualizar: ' + e.message);
    }
}

// ========== GESTIÓN DE PESTAÑAS DE PERFIL ==========
function showProfileTab(tabName) {
    // Ocultar todas las pestañas
    document.querySelectorAll('.profile-tab-content').forEach(tab => tab.style.display = 'none');
    // Quitar clase activa de los botones
    document.querySelectorAll('.profile-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
        btn.style.background = 'none';
        btn.style.color = 'var(--text-secondary)';
    });

    // Mostrar pestaña seleccionada
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';

        // Resaltar botón
        const btn = Array.from(document.querySelectorAll('.profile-tab-btn')).find(b => b.getAttribute('onclick').includes(`'${tabName}'`));
        if (btn) {
            btn.classList.add('active');
            btn.style.background = 'var(--bg-primary)';
            btn.style.color = 'var(--primary-color)';
        }

        // Si es reportes, generar reportes
        if (tabName === 'reportes') {
            generateReports();
        }
        // Si es sucursales, cargar sucursales
        if (tabName === 'sucursales') {
            renderBranches();
        }
        // Si es usuarios, cargar empleados
        if (tabName === 'usuarios') {
            renderEmployees();
        }
    }
}

function renderBranches() {
    const list = document.getElementById('branches-list');
    const addForm = document.getElementById('add-branch-form-container');
    const upgradeMsg = document.getElementById('branch-pro-only-msg');

    list.innerHTML = '';

    // Control de Plan Pro - Usar el estado global robusto
    const isPro = currentRestaurantPlan === 'pro';
    console.log('🏢 Renderizando sucursales - IsPro:', isPro);

    if (isPro) {
        if (addForm) addForm.style.display = 'block';
        if (upgradeMsg) upgradeMsg.style.display = 'none';
    } else {
        if (addForm) addForm.style.display = 'none';
        if (upgradeMsg) upgradeMsg.style.display = 'block';
    }

    if (!window.myBranches || window.myBranches.length === 0) {
        list.innerHTML = '<p style="color: #666; text-align: center; padding: 2rem;">No se encontraron sucursales.</p>';
        return;
    }

    window.myBranches.forEach(branch => {
        const isCurrent = branch.id === parseInt(localStorage.getItem('restaurantId'));
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: ${isCurrent ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
            padding: 1rem 1.5rem;
            border-radius: 10px;
            border: 1px solid ${isCurrent ? 'var(--primary-color)' : 'var(--border-color)'};
            transition: all 0.2s;
        `;

        div.innerHTML = `
            <div>
                <h4 style="margin: 0; color: var(--text-primary);">${branch.name} ${isCurrent ? '<span style="font-size: 0.7rem; background: var(--primary-color); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">ACTIVA</span>' : ''}</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${branch.plan} Plan</p>
            </div>
            ${!isCurrent ? `<button onclick="switchBranch(${branch.id}, '${branch.name}')" class="btn-primary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.8rem;">Cambiar a esta</button>` : ''}
        `;
        list.appendChild(div);
    });
}

async function switchBranch(id, name) {
    if (!confirm(`¿Deseas cambiar a la sucursal "${name}"?`)) return;

    // Guardar el nuevo ID de restaurante
    localStorage.setItem('restaurantId', id);
    localStorage.setItem('activeBranchId', id); // Usar misma convención

    // Actualizar el objeto de usuario local para mantener la sesión activa
    if (currentUser) {
        currentUser.restaurant_id = id;
        currentUser.restaurant_name = name;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // También actualizar el objeto global
        window.currentUser = currentUser;
    }

    // Notificar al API del cambio antes de recargar
    posApi.restaurantId = id;

    alert(`Cambiando a sucursal: ${name}`);
    location.reload();
}

async function handleAddBranch() {
    const input = document.getElementById('new-branch-name');
    const name = input.value.trim();

    if (!name) {
        alert('Por favor, ingresa el nombre de la sucursal.');
        return;
    }

    try {
        const response = await posApi.createBranch(name);
        if (response.success) {
            alert('¡Sucursal "' + name + '" creada con éxito!');
            input.value = ''; // Limpiar campo
            // Recargar perfil para ver cambios
            showProfile();
            showProfileTab('sucursales');
        } else {
            alert('Error: ' + response.error);
        }
    } catch (e) {
        alert('Error al crear sucursal: ' + e.message);
    }
}

// ========== PRODUCTOS ==========
async function loadProducts() {
    try {
        products = await posApi.getProducts();
        renderProducts();
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos');
    }
}

// ========== PRODUCTOS V2 ==========
let selectedCategory = 'all';

async function loadProducts() {
    try {
        products = await posApi.getProducts();
        renderCategories();
        renderProducts();
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos');
    }
}

function renderCategories() {
    const filters = document.getElementById('category-filters');
    if (!filters) return;

    // Extraer categorías únicas de los productos
    // Si no tienen categorías definidas, podríamos usar etiquetas o simplemente 'General'
    // Como no hay campo 'category' en el objeto actual, usaremos una lógica simple o las crearemos.
    // El usuario no pidió categorías específicas, pero para que sea PRO las simularemos o usaremos 'General'.
    const uniqueCategories = ['all', ...new Set(products.map(p => p.category || 'General'))];

    filters.innerHTML = uniqueCategories.map(cat => `
        <span class="category-chip ${selectedCategory === cat ? 'active' : ''}" 
              onclick="filterByCategory('${cat}')">${cat === 'all' ? 'Todos' : cat}</span>
    `).join('');
}

function filterByCategory(category) {
    selectedCategory = category;
    renderCategories();
    renderProducts();
}

function renderProducts() {
    const ventaList = document.getElementById('product-list-venta');
    const adminList = document.getElementById('product-list-admin');
    const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';

    if (ventaList) ventaList.innerHTML = '';
    if (adminList) adminList.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || (p.category || 'General') === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    filtered.forEach((product) => {
        // Vista Venta (Premium)
        if (ventaList) {
            const card = document.createElement('div');
            card.className = 'product-card-v2';
            card.onclick = () => showCustomizationModal(product.id, product.name, product.price);
            card.innerHTML = `
                <span class="icon">${product.img || '🍔'}</span>
                <h4>${product.name}</h4>
                <p class="price">$${parseFloat(product.price).toFixed(2)}</p>
                <button class="add-btn-v2">Agregar +</button>
            `;
            ventaList.appendChild(card);
        }

        // Vista Admin (Tabla/Lista simple)
        if (adminList) {
            const adminItem = document.createElement('div');
            adminItem.className = 'product-item';
            adminItem.innerHTML = `
                <div style="font-size: 2em;">${product.img}</div>
                <h4>${product.name}</h4>
                <p>$${parseFloat(product.price).toFixed(2)}</p>
                <button onclick="removeProduct(${product.id})" style="background-color: var(--danger-color); color: white; border: none; padding: 0.5rem; border-radius: 4px; pointer-events: auto;">Eliminar</button>
            `;
            adminList.appendChild(adminItem);
        }
    });
}

async function addProduct() {
    const name = document.getElementById('new-product-name').value.trim();
    const price = parseFloat(document.getElementById('new-product-price').value);

    if (!name || !price || price <= 0) {
        alert('Por favor ingresa un nombre y precio válidos');
        return;
    }

    try {
        await posApi.addProduct(name, price, '🍔', newProductModifiers);
        document.getElementById('new-product-name').value = '';
        document.getElementById('new-product-price').value = '';
        newProductModifiers = [];
        renderModifierTags();
        showNotification('Producto agregado exitosamente');
        await loadProducts();
    } catch (error) {
        alert('Error al agregar producto: ' + error.message);
    }
}

// ========== LOGICA DE MODIFICADORES DINAMICOS ==========
function handleModifierEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addModifierTag();
    }
}

function addModifierTag() {
    const input = document.getElementById('new-modifier-input');
    const value = input.value.trim();

    if (value && !newProductModifiers.includes(value)) {
        newProductModifiers.push(value);
        input.value = '';
        renderModifierTags();
    }
}

function removeModifierTag(index) {
    newProductModifiers.splice(index, 1);
    renderModifierTags();
}

function renderModifierTags() {
    const container = document.getElementById('modifiers-container');
    if (!container) return;

    container.innerHTML = '';

    newProductModifiers.forEach((mod, index) => {
        const tag = document.createElement('div');
        tag.style.cssText = `
            background: #E0E7FF;
            color: #3730A3;
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        `;

        tag.innerHTML = `
            ${mod}
            <span onclick="removeModifierTag(${index})" style="cursor: pointer; color: #4F46E5; font-weight: bold; padding-left: 0.2rem;">&times;</span>
        `;

        container.appendChild(tag);
    });
}

async function removeProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;

    try {
        await posApi.deleteProduct(id);
        showNotification('Producto eliminado');
        await loadProducts();
    } catch (error) {
        alert('Error al eliminar producto: ' + error.message);
    }
}

// ========== CARRITO ==========
function addToCart(id, name, price) {
    // Siempre mostrar ventana de personalización para todos los roles
    showCustomizationModal(id, name, price);
}

function showCustomizationModal(id, name, price) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'customization-modal';

    const product = products.find(p => p.id === id);
    let modifiersArray = [];
    if (product && product.modifiers) {
        modifiersArray = typeof product.modifiers === 'string' ? JSON.parse(product.modifiers) : product.modifiers;
    }

    let modifierOptions = '';
    if (modifiersArray && modifiersArray.length > 0) {
        modifierOptions = modifiersArray.map(mod => `
            <label class="modifier-option">
                <input type="checkbox" value="${mod}" class="customization-checkbox" 
                    onchange="this.parentElement.classList.toggle('selected', this.checked); updateQuantityDisplay(${price})">
                <span class="modifier-label">${mod}</span>
            </label>
        `).join('');
    } else {
        modifierOptions = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); opacity: 0.7;">Sin opciones de personalización</p>';
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🌭 Personalizar</h3>
                <div class="product-info">${name} — $${parseFloat(price).toFixed(2)} c/u</div>
            </div>
            
            <div class="modal-body">
                <div class="quantity-section">
                    <div class="modifiers-section-title">Cantidad</div>
                    <div class="quantity-control">
                        <button class="btn-qty" onclick="decreaseQuantity()">−</button>
                        <input type="number" id="quantity-input" class="qty-input" value="1" min="1" max="99" oninput="updateQuantityDisplay(${price})" readonly>
                        <button class="btn-qty" onclick="increaseQuantity()">+</button>
                    </div>
                </div>

                <div class="modifiers-section">
                    <div class="modifiers-section-title">Modificadores</div>
                    <div class="modifiers-grid">
                        ${modifierOptions}
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <div class="total-row">
                    <span>Total estimado</span>
                    <span class="total-amount">$<span id="quantity-total">${parseFloat(price).toFixed(2)}</span></span>
                </div>
                <div class="modal-actions">
                    <button class="btn-modal btn-cancel" onclick="closeCustomizationModal()">Cancelar</button>
                    <button class="btn-modal btn-confirm" onclick="confirmCustomization(${id}, '${name}', ${price}, event)">✓ Agregar al Carrito</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) closeCustomizationModal();
    };
}

// ========== FUNCIONES DE CANTIDAD ==========
function increaseQuantity() {
    const input = document.getElementById('quantity-input');
    let quantity = parseInt(input.value) || 1;
    if (quantity < 99) {
        input.value = quantity + 1;
        input.dispatchEvent(new Event('input'));
    }
}

function decreaseQuantity() {
    const input = document.getElementById('quantity-input');
    let quantity = parseInt(input.value) || 1;
    if (quantity > 1) {
        input.value = quantity - 1;
        input.dispatchEvent(new Event('input'));
    }
}

function updateQuantityDisplay(unitPrice) {
    const input = document.getElementById('quantity-input');
    let quantity = parseInt(input.value) || 1;

    if (quantity < 1) {
        quantity = 1;
        input.value = 1;
    }
    if (quantity > 99) {
        quantity = 99;
        input.value = 99;
    }

    // Calcular precio de extras si existen (aunque por ahora los modificadores no tienen precio, 
    // mantenemos la lógica por si el usuario decide añadirlos después)
    let extrasPrice = 0;
    const modal = document.getElementById('customization-modal');
    if (modal) {
        const selectedOptions = modal.querySelectorAll('.customization-checkbox:checked');
        selectedOptions.forEach(checkbox => {
            const priceAttr = parseFloat(checkbox.getAttribute('data-price')) || 0;
            extrasPrice += priceAttr;
        });
    }

    const total = (quantity * parseFloat(unitPrice)) + (quantity * extrasPrice);
    document.getElementById('quantity-total').textContent = total.toFixed(2);
}

function closeCustomizationModal() {
    const modal = document.getElementById('customization-modal');
    if (modal) {
        modal.remove();
    }
}

function confirmCustomization(id, name, price, event) {
    if (event) event.preventDefault();

    const modal = document.getElementById('customization-modal');
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
    const customizations = Array.from(checkboxes).map(cb => cb.value);
    const quantity = parseInt(document.getElementById('quantity-input').value) || 1;

    // Calcular precio base
    let unitPrice = parseFloat(price);

    // Calcular precio de extras si existen
    let extrasPrice = 0;
    const extraCheckboxes = modal.querySelectorAll('.customization-checkbox:checked');
    extraCheckboxes.forEach(checkbox => {
        const extraPrice = parseFloat(checkbox.getAttribute('data-price')) || 0;
        extrasPrice += extraPrice;
    });

    // Precio unitario total (precio base + extras)
    const totalUnitPrice = unitPrice + extrasPrice;

    // Precio total del item (precio unitario * cantidad)
    const itemTotal = totalUnitPrice * quantity;

    cart.push({
        id,
        name,
        unitPrice: totalUnitPrice,
        quantity: quantity,
        price: itemTotal,
        customizations: customizations
    });
    total += itemTotal;
    updateCart();
    closeCustomizationModal();

    const customText = customizations.length > 0 ? ` (${customizations.join(', ')})` : '';
    const quantityText = quantity > 1 ? `${quantity}x ` : '';
    showNotification(`${quantityText}${name}${customText} agregado al carrito`);
}

function updateCart() {
    const cartDiv = document.getElementById('cart-content');
    if (!cartDiv) return;

    cartDiv.innerHTML = '';

    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';

        const customizations = item.customizations && item.customizations.length > 0
            ? `<br><small style="color: var(--primary-color);">✨ ${item.customizations.join(', ')}</small>`
            : '';

        div.innerHTML = `
            <div class="cart-item-info">
                <span>${item.quantity}x ${item.name}</span>
                <small>$${(item.unitPrice || item.price).toFixed(2)} c/u</small>
                ${customizations}
            </div>
            <div class="cart-item-controls">
                <button class="cart-item-btn" onclick="removeFromCart(${index})" style="background:var(--danger-color); color:white; border:none;">×</button>
            </div>
        `;
        cartDiv.appendChild(div);
    });

    const totalDisplay = document.getElementById('cart-total-display');
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)}`;
    }
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('¿Vaciar todo el carrito?')) {
        cart = [];
        total = 0;
        updateCart();
        showNotification('Carrito vaciado');
    }
}

function increaseCartQuantity(index) {
    const item = cart[index];
    if (item.quantity < 99) {
        const unitPrice = item.unitPrice || item.price;
        item.quantity++;
        const oldPrice = item.price;
        item.price = unitPrice * item.quantity;
        total = total - oldPrice + item.price;
        updateCart();
        showNotification(`Cantidad actualizada: ${item.quantity}x ${item.name}`);
    }
}

function decreaseCartQuantity(index) {
    const item = cart[index];
    if (item.quantity > 1) {
        const unitPrice = item.unitPrice || item.price;
        item.quantity--;
        const oldPrice = item.price;
        item.price = unitPrice * item.quantity;
        total = total - oldPrice + item.price;
        updateCart();
        showNotification(`Cantidad actualizada: ${item.quantity}x ${item.name}`);
    }
}

function removeFromCart(index) {
    total -= cart[index].price;
    cart.splice(index, 1);
    updateCart();
}

async function sendOrder() {
    if (cart.length === 0) {
        alert('El carrito está vacío.');
        return;
    }

    try {
        const order = await posApi.createOrder(
            currentUser.username,
            cart,
            total,
            'Pendiente'
        );

        showNotification('Pedido enviado exitosamente');
        cart = [];
        total = 0;
        updateCart();

        await loadOrders();
    } catch (error) {
        alert('Error al enviar pedido: ' + error.message);
    }
}

// ========== PEDIDOS ==========
async function loadOrders() {
    try {
        console.log('=== loadOrders iniciado ===');
        pendingOrders = await posApi.getOrders();
        console.log('Pedidos cargados:', pendingOrders);
        console.log('Número de pedidos:', pendingOrders.length);
        console.log('Usuario actual:', currentUser);

        renderPendingOrders();
        renderCashierPendingOrders();
        renderCashierPaidOrders();
        renderKitchenOrders();

        // Si es empleado, actualizar sus vistas también
        if (currentUser && currentUser.role === 'empleado') {
            console.log('Usuario es empleado, actualizando vistas de empleado...');
            renderEmployeePendingOrders();
            renderEmployeeOrderHistory(employeeHistoryFilter);
        }

        updateKitchenStats();
        console.log('=== loadOrders completado ===');
    } catch (error) {
        console.error('Error cargando pedidos:', error);
        console.error('Stack trace:', error.stack);
    }
}

// ========== LÓGICA DE TIEMPOS DINÁMICOS CON CUENTA REGRESIVA REAL ==========
function calculateOrderTimes(orderId) {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return { startInSeconds: 60, readyInSeconds: 300 };

    // Calcular SEGUNDOS transcurridos desde que se creó el pedido
    const createdTime = new Date(order.created_at).getTime();
    const now = new Date().getTime();
    const elapsedSeconds = (now - createdTime) / 1000;

    // Pedidos que están antes en la cola (Pendientes o En Preparación)
    // IMPORTANTE: Los pedidos vienen de la DB en DESC (nuevo primero), 
    // pero para la cola cocinamos FIFO (viejo primero).
    const activeOrders = pendingOrders
        .filter(o => o.status === 'Pendiente' || o.status === 'En Preparación')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // ASC: Viejo primero

    const orderIndex = activeOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) return { startInSeconds: 0, readyInSeconds: 0 };

    // Cálculo base de tiempo para empezar (en segundos)
    let startInSeconds = 60; // Base 1 min
    if (orderIndex > 0) {
        // Sumamos 2 min por cada platillo de los pedidos anteriores en la cola
        const previousOrders = activeOrders.slice(0, orderIndex);
        const totalPreviousItems = previousOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + (i.quantity || 1), 0), 0);
        startInSeconds = totalPreviousItems * 120; // 120s = 2min
    }

    // Restar el tiempo que ya ha pasado
    startInSeconds = Math.max(1, startInSeconds - elapsedSeconds);

    // Cálculo de tiempo para estar listo (una vez empezado, en segundos)
    const currentItemsCount = order.items.reduce((s, i) => s + (i.quantity || 1), 0);
    let readyInSeconds = currentItemsCount * 180; // Estimamos 3 min por platillo

    // Si ya está en preparación, el tiempo baja según el transcurrido desde creación (estimado)
    if (order.status === 'En Preparación') {
        readyInSeconds = Math.max(1, readyInSeconds - (elapsedSeconds * 0.7)); // Factor de avance
    }

    return { startInSeconds, readyInSeconds };
}

function updateKitchenStats() {
    const statsDiv = document.getElementById('kitchen-stats');
    if (!statsDiv) return;

    const enEspera = pendingOrders.filter(o => o.status === 'Pendiente').length;
    const preparando = pendingOrders.filter(o => o.status === 'En Preparación').length;
    statsDiv.textContent = `⏳ ${enEspera} en espera | 🔥 ${preparando} preparando`;
}

function renderPendingOrders() {
    const ordersDiv = document.getElementById('pending-orders');
    if (!ordersDiv) return;

    ordersDiv.innerHTML = '';

    pendingOrders.forEach((order) => {
        if (order.status === 'Cobrado') return;

        const div = document.createElement('div');
        div.className = `order-card-compact ${order.status.toLowerCase().replace(' ', '-')}`;

        const times = calculateOrderTimes(order.id);
        const timeBadge = order.status === 'Pendiente'
            ? `<div class="order-card-status" style="background:#fff3e0; color:#e65100;">⏳ ${formatCountdown(times.startInSeconds)}</div>`
            : (order.status === 'En Preparación' ? `<div class="order-card-status" style="background:#e3f2fd; color:#1565c0;">🔥 ${formatCountdown(times.readyInSeconds)}</div>` : `<div class="order-card-status" style="background:#e8f5e9; color:#2e7d32;">✅ LISTO</div>`);

        const itemsList = order.items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

        div.innerHTML = `
            <div class="order-card-header">
                <div>
                    <h4>Pedido #${order.id}</h4>
                    <small style="color:var(--text-secondary)">${order.employee || 'Admin'}</small>
                </div>
                ${timeBadge}
            </div>
            <ul class="order-card-items">${itemsList}</ul>
            <div class="order-card-footer">
                <span class="order-card-total">$${parseFloat(order.total).toFixed(2)}</span>
                <div style="display:flex; gap:5px;">
                    ${order.status === 'Pendiente' ? `<button onclick="updateOrderStatus(${order.id}, 'En Preparación')" style="background:var(--info-color); color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;">Empezar</button>` : ''}
                    ${order.status === 'En Preparación' ? `<button onclick="updateOrderStatus(${order.id}, 'Finalizado')" style="background:var(--success-color); color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;">Listo</button>` : ''}
                </div>
            </div>
        `;
        ordersDiv.appendChild(div);
    });
}

async function loadKitchenOrders() {
    await loadOrders();
}

function renderKitchenOrders() {
    const kitchenOrdersDiv = document.getElementById('kitchen-orders');
    const kitchenHistoryDiv = document.getElementById('kitchen-history');
    if (!kitchenOrdersDiv) return;

    kitchenOrdersDiv.innerHTML = '';
    if (kitchenHistoryDiv) kitchenHistoryDiv.innerHTML = '';

    const sortedOrders = [...pendingOrders].reverse();

    sortedOrders.forEach(order => {
        const times = calculateOrderTimes(order.id);

        if (order.status === 'Finalizado' || order.status === 'Cobrado') {
            if (kitchenHistoryDiv) {
                const historyItem = document.createElement('div');
                historyItem.className = 'card';
                historyItem.style.padding = '0.75rem';
                historyItem.style.marginBottom = '0.5rem';
                historyItem.style.opacity = '0.7';
                historyItem.style.borderLeft = order.status === 'Cobrado' ? '5px solid #27ae60' : '5px solid #2ecc71';

                const itemsStr = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');

                historyItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin:0;">Pedido #${order.id}</h4>
                        <span style="font-size: 0.7rem; font-weight: bold; color: ${order.status === 'Cobrado' ? '#27ae60' : '#2ecc71'};">${order.status.toUpperCase()}</span>
                    </div>
                    <small style="color: var(--text-secondary);">${itemsStr}</small>
                `;
                kitchenHistoryDiv.appendChild(historyItem);
            }
            return;
        }

        const div = document.createElement('div');
        div.className = `card order-card-kitchen ${order.status === 'En Preparación' ? 'preparing-glow' : ''}`;
        div.style.borderLeft = order.status === 'En Preparación' ? '8px solid #3498db' : '8px solid #ff6b35';
        div.style.padding = '1.5rem';

        const itemsList = order.items.map(item => {
            const quantity = item.quantity || 1;
            const custom = item.customizations && item.customizations.length > 0 ? `<br><small style="color:red">(!) ${item.customizations.join(', ')}</small>` : '';
            return `<li style="margin-bottom: 0.5rem; font-size: 1.1rem;"><strong>${quantity}x</strong> ${item.name}${custom}</li>`;
        }).join('');

        const isPreparing = order.status === 'En Preparación';
        const timeBadge = isPreparing
            ? `<span class="countdown-badge" data-order-id="${order.id}" style="background: #3498db; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">🔥 PREPARANDO - ~${formatCountdown(times.readyInSeconds)}</span>`
            : `<span class="countdown-badge" data-order-id="${order.id}" style="background: #ff6b35; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">⏳ EN ESPERA - ~${formatCountdown(times.startInSeconds)}</span>`;

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0; color: var(--text-primary);">Pedido #${order.id}</h3>
                    <small style="color: var(--text-secondary);">${order.employee || 'Mesero'}</small>
                </div>
                ${timeBadge}
            </div>
            <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem;">${itemsList}</ul>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                ${!isPreparing ?
                `<button onclick="updateOrderStatus(${order.id}, 'En Preparación')" style="background: #3498db; color: white; border: none; padding: 1rem; border-radius: 8px; font-weight: bold; cursor: pointer; grid-column: span 2;">🔥 EMPEZAR AHORA</button>` :
                `<button onclick="updateOrderStatus(${order.id}, 'Finalizado')" style="background: #2ecc71; color: white; border: none; padding: 1rem; border-radius: 8px; font-weight: bold; cursor: pointer; grid-column: span 2;">✅ MARCÁR COMO LISTO</button>`
            }
            </div>
        `;
        kitchenOrdersDiv.appendChild(div);
    });
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await posApi.updateOrderStatus(orderId, newStatus);
        showNotification(`Pedido #${orderId} actualizado a: ${newStatus}`);
        await loadOrders();
    } catch (error) {
        alert('Error al actualizar pedido: ' + error.message);
    }
}

// ========== CAJA - PEDIDOS PENDIENTES DE COBRAR ==========
function renderCashierPendingOrders() {
    const ordersDiv = document.getElementById('cashier-pending-orders');
    if (!ordersDiv) return;

    ordersDiv.innerHTML = '';

    const finalizados = pendingOrders.filter(o => o.status === 'Finalizado');

    if (finalizados.length === 0) {
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem; grid-column: 1/-1;">No hay pedidos listos por cobrar</p>';
        return;
    }

    finalizados.forEach((order) => {
        const div = document.createElement('div');
        div.className = 'order-card-compact finalizado';

        const itemsList = order.items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

        div.innerHTML = `
            <div class="order-card-header">
                <div>
                    <h4>Pedido #${order.id}</h4>
                    <small style="color:var(--text-secondary)">${order.employee || 'Anónimo'}</small>
                </div>
                <div class="order-card-status" style="background:#e8f5e9; color:#2e7d32;">✓ LISTO</div>
            </div>
            <ul class="order-card-items">${itemsList}</ul>
            <div class="order-card-footer">
                <span class="order-card-total">$${parseFloat(order.total).toFixed(2)}</span>
                <button onclick="showPaymentModal(${order.id}, ${order.total})" style="background:var(--success-color); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">💰 Cobrar</button>
            </div>
        `;
        ordersDiv.appendChild(div);
    });
}

// ========== MODAL DE PAGO ==========
function showPaymentModal(orderId, total) {
    const modal = document.createElement('div');
    modal.id = 'payment-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;

    modal.innerHTML = `
        <div style="background: white; padding: 2.5rem; border-radius: 16px; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            <h3 style="color: #FF6B35; margin-bottom: 1.5rem; text-align: center;">💰 Cobrar Pedido #${orderId}</h3>
            
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #1a252f;"><strong>Total a cobrar:</strong></p>
                <p style="font-size: 2rem; font-weight: 700; color: #FF6B35; margin: 0;">$${parseFloat(total).toFixed(2)}</p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; color: #1a252f; font-weight: 600;">Método de Pago:</label>
                <select id="payment-method" onchange="handlePaymentMethodChange(${total})" style="width: 100%; padding: 1rem; border: 2px solid #FF6B35; border-radius: 8px; font-size: 1.1rem; font-weight: 600; background: white; cursor: pointer;">
                    <option value="Efectivo">💵 Efectivo</option>
                    <option value="Tarjeta">💳 Tarjeta</option>
                    <option value="Transferencia">📱 Transferencia</option>
                </select>
            </div>
            
            <div id="amount-input-container" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; color: #1a252f; font-weight: 600;">Monto recibido:</label>
                <input type="number" id="payment-amount" step="0.01" min="0" placeholder="0.00" 
                    oninput="calculateChange(${total})"
                    style="width: 100%; padding: 1rem; border: 2px solid #FF6B35; border-radius: 8px; font-size: 1.3rem; font-weight: 700; text-align: center;">
            </div>
            
            <div id="change-display" style="background: #E8F5E9; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #1a252f;"><strong>Cambio:</strong></p>
                <p style="font-size: 1.8rem; font-weight: 700; color: #2ECC71; margin: 0;">$<span id="change-amount">0.00</span></p>
            </div>
            
            <div id="insufficient-display" style="background: #FFEBEE; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
                <p style="color: #E74C3C; font-weight: 600; margin: 0;">⚠️ Monto insuficiente</p>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closePaymentModal()" style="background: #6c757d; color: white; border: none; padding: 0.875rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer;">Cancelar</button>
                <button id="confirm-payment-btn" onclick="confirmPayment(${orderId}, ${total})" disabled style="background: #ccc; color: white; border: none; padding: 0.875rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: not-allowed;">✓ Confirmar Pago</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePaymentModal();
        }
    });

    setTimeout(() => {
        document.getElementById('payment-amount').focus();
    }, 100);
}

function handlePaymentMethodChange(total) {
    const paymentMethod = document.getElementById('payment-method').value;
    const amountInput = document.getElementById('payment-amount');
    const changeDisplay = document.getElementById('change-display');
    const insufficientDisplay = document.getElementById('insufficient-display');
    const confirmBtn = document.getElementById('confirm-payment-btn');

    if (paymentMethod === 'Tarjeta' || paymentMethod === 'Transferencia') {
        // Para tarjeta y transferencia, el monto es exacto
        amountInput.value = parseFloat(total).toFixed(2);
        amountInput.readOnly = true;
        amountInput.style.background = '#f0f0f0';
        changeDisplay.style.display = 'none';
        insufficientDisplay.style.display = 'none';

        // Habilitar botón de confirmar
        confirmBtn.disabled = false;
        confirmBtn.style.background = '#27ae60';
        confirmBtn.style.cursor = 'pointer';
    } else {
        // Para efectivo, permitir ingresar monto
        amountInput.value = '';
        amountInput.readOnly = false;
        amountInput.style.background = 'white';
        changeDisplay.style.display = 'none';
        insufficientDisplay.style.display = 'none';

        // Deshabilitar botón hasta que se ingrese un monto válido
        confirmBtn.disabled = true;
        confirmBtn.style.background = '#ccc';
        confirmBtn.style.cursor = 'not-allowed';

        amountInput.focus();
    }
}

function calculateChange(total) {
    const amountInput = document.getElementById('payment-amount');
    const amount = parseFloat(amountInput.value) || 0;
    const change = amount - total;

    const changeDisplay = document.getElementById('change-display');
    const insufficientDisplay = document.getElementById('insufficient-display');
    const confirmBtn = document.getElementById('confirm-payment-btn');

    if (amount >= total && amount > 0) {
        changeDisplay.style.display = 'block';
        insufficientDisplay.style.display = 'none';
        document.getElementById('change-amount').textContent = change.toFixed(2);
        confirmBtn.disabled = false;
        confirmBtn.style.background = '#27ae60';
        confirmBtn.style.cursor = 'pointer';
    } else if (amount > 0) {
        changeDisplay.style.display = 'none';
        insufficientDisplay.style.display = 'block';
        confirmBtn.disabled = true;
        confirmBtn.style.background = '#ccc';
        confirmBtn.style.cursor = 'not-allowed';
    } else {
        changeDisplay.style.display = 'none';
        insufficientDisplay.style.display = 'none';
        confirmBtn.disabled = true;
        confirmBtn.style.background = '#ccc';
        confirmBtn.style.cursor = 'not-allowed';
    }
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) {
        modal.remove();
    }
}

async function confirmPayment(orderId, total) {
    console.log('=== INICIO confirmPayment ===');
    console.log('orderId:', orderId, 'total:', total);

    const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
    console.log('amount:', amount);

    if (amount < total) {
        alert('El monto recibido es insuficiente');
        return;
    }

    try {
        // Obtener el pedido antes de actualizar Y HACER UNA COPIA PROFUNDA
        console.log('Buscando pedido en pendingOrders...');
        const order = pendingOrders.find(o => o.id === orderId);
        console.log('Pedido encontrado:', order);

        if (!order) {
            alert('Pedido no encontrado');
            return;
        }

        // IMPORTANTE: Hacer una copia profunda del pedido ANTES de cualquier actualización
        // porque después de loadOrders() el pedido ya no estará en pendingOrders
        const orderCopy = JSON.parse(JSON.stringify(order));
        console.log('Copia del pedido creada:', orderCopy);

        const change = amount - total;
        console.log('Cambio calculado:', change);

        // Actualizar estado del pedido
        console.log('Actualizando estado del pedido...');
        await posApi.updateOrderStatus(orderId, 'Cobrado');
        console.log('Estado actualizado');

        // Guardar el ticket en la base de datos usando createTicket
        console.log('Creando ticket...');

        // Asegurarse de que tenemos el nombre del empleado correcto
        const employeeName = orderCopy.employee || orderCopy.username || currentUser.username;

        console.log('Parámetros para createTicket:', {
            order_id: orderId,
            employee: employeeName,
            items: orderCopy.items,
            total: orderCopy.total,
            amount_received: amount,
            change_given: change
        });

        // Obtener el método de pago seleccionado
        const paymentMethod = document.getElementById('payment-method').value;

        await posApi.createTicket(
            orderId,
            employeeName,
            orderCopy.items,
            orderCopy.total,
            amount,
            change,
            paymentMethod
        );
        console.log('Ticket creado');

        // Cerrar modal de pago
        console.log('Cerrando modal de pago...');
        closePaymentModal();

        // IMPORTANTE: Mostrar el ticket ANTES de actualizar las listas
        // para asegurar que se muestre correctamente
        console.log('Llamando a showReceipt...');
        console.log('Datos para showReceipt:', { orderCopy, amount, change, paymentMethod });
        showReceipt(orderCopy, amount, change, paymentMethod);
        console.log('Ticket mostrado');

        // Mostrar notificación según el método de pago
        const changeMsg = change > 0 ? ` Cambio: $${change.toFixed(2)}` : '';
        showNotification(`Pedido #${orderId} cobrado con ${paymentMethod}.${changeMsg}`);

        // Actualizar listas DESPUÉS de mostrar el ticket
        console.log('Actualizando listas...');
        await loadOrders();
        await loadTickets();
        console.log('Listas actualizadas');
        console.log('=== FIN confirmPayment ===');

    } catch (error) {
        console.error('Error completo:', error);
        alert('Error al procesar el pago: ' + error.message);
    }
}

// ========== CAJA - PEDIDOS COBRADOS ==========
function renderCashierPaidOrders() {
    const ordersDiv = document.getElementById('cashier-paid-orders');
    if (!ordersDiv) return;

    ordersDiv.innerHTML = '';

    const cobrados = pendingOrders.filter(o => o.status === 'Cobrado');

    if (cobrados.length === 0) {
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem; grid-column: 1/-1;">No hay historial de cobros hoy</p>';
        return;
    }

    cobrados.forEach((order) => {
        const div = document.createElement('div');
        div.className = 'order-card-compact cobrado';

        const itemsList = order.items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

        div.innerHTML = `
            <div class="order-card-header">
                <div>
                    <h4>Pedido #${order.id}</h4>
                    <small style="color:var(--text-secondary)">${order.employee || 'Anónimo'}</small>
                </div>
                <div class="order-card-status" style="background:var(--bg-primary); color:var(--text-secondary);">FINALIZADO</div>
            </div>
            <ul class="order-card-items">${itemsList}</ul>
            <div class="order-card-footer">
                <span class="order-card-total" style="color:var(--text-secondary)">$${parseFloat(order.total).toFixed(2)}</span>
                <span style="font-size:0.7rem; color:var(--text-secondary)">${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;
        ordersDiv.appendChild(div);
    });
}

// ========== TICKETS ==========
async function loadTickets() {
    try {
        console.log('Cargando tickets...');
        printedTickets = await posApi.getTickets();
        console.log('Tickets cargados:', printedTickets);
        renderTickets();
    } catch (error) {
        console.error('Error cargando tickets:', error);
    }
}

function renderTickets() {
    console.log('Renderizando tickets...');
    const ticketsDiv = document.getElementById('ticket-list');
    if (!ticketsDiv) {
        console.error('No se encontró el elemento #ticket-list');
        return;
    }

    ticketsDiv.innerHTML = '';

    console.log('Número de tickets:', printedTickets.length);

    if (printedTickets.length === 0) {
        ticketsDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No hay tickets impresos</p>';
        return;
    }

    printedTickets.forEach((ticket) => {
        console.log('Renderizando ticket:', ticket);

        // Determinar el icono del método de pago
        let paymentIcon = '💵';
        if (ticket.payment_method === 'Tarjeta') paymentIcon = '💳';
        else if (ticket.payment_method === 'Transferencia') paymentIcon = '📱';

        const div = document.createElement('div');
        div.className = 'ticket-item';
        div.innerHTML = `
            <h4>Ticket #${ticket.id} - Pedido #${ticket.order_id}</h4>
            <p><strong>Método:</strong> ${paymentIcon} ${ticket.payment_method || 'Efectivo'}</p>
            <p><strong>Total:</strong> $${parseFloat(ticket.total).toFixed(2)}</p>
            <p><strong>Recibido:</strong> $${parseFloat(ticket.amount_received).toFixed(2)}</p>
            ${ticket.change_given > 0 ? `<p><strong>Cambio:</strong> $${parseFloat(ticket.change_given).toFixed(2)}</p>` : ''}
            <p><small>${new Date(ticket.printed_at).toLocaleString()}</small></p>
            <button onclick="reprintTicket(${ticket.order_id}, ${ticket.amount_received}, ${ticket.change_given}, '${ticket.payment_method || 'Efectivo'}')">Reimprimir</button>
        `;
        ticketsDiv.appendChild(div);
    });
    console.log('Tickets renderizados correctamente');
}

async function reprintTicket(orderId, amount, change, paymentMethod = 'Efectivo') {
    try {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) {
            alert('Pedido no encontrado');
            return;
        }

        showReceipt(order, amount, change, paymentMethod);
    } catch (error) {
        alert('Error al reimprimir ticket: ' + error.message);
    }
}

function showReceipt(order, amountReceived, changeGiven, paymentMethod = 'Efectivo') {
    console.log('showReceipt llamado con:', { order, amountReceived, changeGiven, paymentMethod });

    const receiptDiv = document.getElementById('receipt');
    const contentDiv = document.getElementById('receipt-content');

    if (!receiptDiv) {
        console.error('No se encontró el elemento #receipt');
        alert('Error: No se encontró el elemento del ticket');
        return;
    }

    if (!contentDiv) {
        console.error('No se encontró el elemento #receipt-content');
        alert('Error: No se encontró el contenedor del ticket');
        return;
    }

    const itemsList = order.items.map(item => {
        const customText = item.customizations && item.customizations.length > 0
            ? ` [${item.customizations.join(', ')}]`
            : '';
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || item.price;
        const displayText = quantity > 1
            ? `${quantity}x ${item.name}${customText} @ $${unitPrice.toFixed(2)} = $${item.price.toFixed(2)}`
            : `${item.name}${customText} - $${item.price.toFixed(2)}`;
        return `<li>${displayText}</li>`;
    }).join('');

    // Determinar el icono del método de pago
    let paymentIcon = '💵';
    if (paymentMethod === 'Tarjeta') paymentIcon = '💳';
    else if (paymentMethod === 'Transferencia') paymentIcon = '📱';

    contentDiv.innerHTML = `
        <p><strong>Pedido #${order.id}</strong></p>
        <p>Atendido por: ${order.username}</p>
        <p>${new Date(order.created_at).toLocaleString()}</p>
        <hr>
        <ul style="list-style: none; padding: 0;">${itemsList}</ul>
        <hr>
        <p><strong>Total: $${parseFloat(order.total).toFixed(2)}</strong></p>
        <p><strong>Método de Pago:</strong> ${paymentIcon} ${paymentMethod}</p>
        <p>Recibido: $${parseFloat(amountReceived).toFixed(2)}</p>
        ${changeGiven > 0 ? `<p><strong>Cambio: $${parseFloat(changeGiven).toFixed(2)}</strong></p>` : ''}
        <hr>
        <p style="text-align: center;">¡Gracias por su compra!</p>
        <p style="text-align: center;">🌭 Vuelva pronto 🌭</p>
    `;

    // Asegurarse de que el ticket sea visible con estilos inline
    receiptDiv.style.display = 'block';
    receiptDiv.style.position = 'fixed';
    receiptDiv.style.top = '50%';
    receiptDiv.style.left = '50%';
    receiptDiv.style.transform = 'translate(-50%, -50%)';
    receiptDiv.style.zIndex = '10001';
    receiptDiv.style.background = 'white';
    receiptDiv.style.padding = '2rem';
    receiptDiv.style.borderRadius = '12px';
    receiptDiv.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
    receiptDiv.style.maxWidth = '500px';
    receiptDiv.style.width = '90%';

    console.log('Ticket mostrado correctamente');
}

function printReceipt() {
    window.print();
}

function cancelReceipt() {
    document.getElementById('receipt').style.display = 'none';
}

// ========== EMPLEADOS ==========
async function renderEmployees() {
    try {
        const users = await posApi.getUsers();
        const employeeList = document.getElementById('employee-list');
        employeeList.innerHTML = '';

        users.forEach((user) => {
            const div = document.createElement('div');
            div.className = 'employee-row';
            div.style.cssText = `
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 0.75rem 1rem;
                background: var(--bg-primary);
                border-bottom: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 0.5rem;
            `;

            const roleIcons = {
                'admin': '🛡️',
                'caja': '💰',
                'empleado': '🏃',
                'cocinero': '👨‍🍳'
            };
            const icon = roleIcons[user.role] || '👤';

            div.innerHTML = `
                <div style="width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <h4 style="margin:0; font-size: 1rem; color: var(--text-primary);">${user.username}</h4>
                    <p style="margin:0; font-size: 0.8rem; color: var(--text-secondary);">${user.role.toUpperCase()}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; color: #2ecc71; font-size: 0.75rem; font-weight: bold;">
                    <div style="width: 8px; height: 8px; background: #2ecc71; border-radius: 50%;"></div>
                    ACTIVO
                </div>
            `;
            employeeList.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando empleados:', error);
    }
}

async function addEmployee() {
    const username = document.getElementById('new-emp-username').value.trim();
    const password = document.getElementById('new-emp-password').value.trim();
    const role = document.getElementById('new-emp-role').value;
    const empMsg = document.getElementById('emp-msg');

    empMsg.textContent = '';

    if (!username || !password) {
        empMsg.textContent = 'Por favor ingresa usuario y contraseña';
        empMsg.style.color = 'red';
        return;
    }

    try {
        await posApi.addUser(username, password, role);
        document.getElementById('new-emp-username').value = '';
        document.getElementById('new-emp-password').value = '';
        empMsg.textContent = 'Empleado agregado exitosamente';
        empMsg.style.color = 'green';
        renderEmployees();
    } catch (error) {
        empMsg.textContent = 'Error: ' + error.message;
        empMsg.style.color = 'red';
    }
}

// ========== AJUSTES ==========
function saveSettings() {
    const newTaxRate = parseFloat(document.getElementById('tax-rate').value);
    if (isNaN(newTaxRate) || newTaxRate < 0) {
        document.getElementById('settings-msg').textContent = 'Tasa de impuesto inválida';
        return;
    }

    taxRate = newTaxRate;
    localStorage.setItem('taxRate', taxRate);
    document.getElementById('settings-msg').textContent = 'Configuración guardada';
    setTimeout(() => {
        document.getElementById('settings-msg').textContent = '';
    }, 3000);
}

// ========== FACTURACIÓN ==========
async function generateInvoice() {
    try {
        const cobrados = pendingOrders.filter(o => o.status === 'Cobrado');

        if (cobrados.length === 0) {
            alert('No hay pedidos cobrados para facturar');
            return;
        }

        const totalVentas = cobrados.reduce((sum, order) => sum + parseFloat(order.total), 0);
        const impuesto = totalVentas * (taxRate / 100);
        const totalConImpuesto = totalVentas + impuesto;

        const invoiceContent = document.getElementById('invoice-content');
        invoiceContent.innerHTML = `
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            <p>Total de pedidos: ${cobrados.length}</p>
            <p>Subtotal: $${totalVentas.toFixed(2)}</p>
            <p>Impuesto (${taxRate}%): $${impuesto.toFixed(2)}</p>
            <p><strong>Total: $${totalConImpuesto.toFixed(2)}</strong></p>
        `;

        document.getElementById('invoice').style.display = 'block';
    } catch (error) {
        alert('Error al generar factura: ' + error.message);
    }
}

function printInvoice() {
    window.print();
}

// ========== EMPLEADO - MIS PEDIDOS ==========
function renderEmployeePendingOrders() {
    const ordersDiv = document.getElementById('employee-pending-orders');
    if (!ordersDiv) return;

    ordersDiv.innerHTML = '';

    if (!currentUser) return;

    // Filtrar solo los pedidos del empleado actual que NO estén cobrados
    const myOrders = pendingOrders.filter(o =>
        o.employee === currentUser.username &&
        o.status !== 'Cobrado'
    );

    if (myOrders.length === 0) {
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem; grid-column: 1/-1;">No tienes pedidos pendientes</p>';
        return;
    }

    myOrders.forEach((order) => {
        const div = document.createElement('div');
        const statusKey = order.status.toLowerCase().replace(' ', '-');
        div.className = `order-card-compact ${statusKey}`;

        const times = calculateOrderTimes(order.id);
        let timeBadge = '';

        if (order.status === 'Pendiente') {
            timeBadge = `<div class="order-card-status employee-countdown-badge" style="background:#fff3e0; color:#e65100;" data-order-id="${order.id}">⏳ ${formatCountdown(times.startInSeconds)}</div>`;
        } else if (order.status === 'En Preparación') {
            timeBadge = `<div class="order-card-status employee-countdown-badge" style="background:#e3f2fd; color:#1565c0;" data-order-id="${order.id}">🔥 ${formatCountdown(times.readyInSeconds)}</div>`;
        } else if (order.status === 'Finalizado') {
            timeBadge = `<div class="order-card-status" style="background:#e8f5e9; color:#2e7d32;">✅ LISTO</div>`;
        }

        const itemsList = order.items.map(item => {
            const quantity = item.quantity || 1;
            return `<li>${quantity}x ${item.name}</li>`;
        }).join('');

        div.innerHTML = `
            <div class="order-card-header">
                <h4>Pedido #${order.id}</h4>
                ${timeBadge}
            </div>
            <p style="font-size:0.75rem; color:var(--text-secondary); margin:0;">Estado: <strong>${order.status}</strong></p>
            <ul class="order-card-items">${itemsList}</ul>
            <div class="order-card-footer">
                <span class="order-card-total">$${parseFloat(order.total).toFixed(2)}</span>
                ${order.status === 'Finalizado' ? '<span style="font-size:0.75rem; font-weight:700; color:var(--success-color); border:1px solid; padding:2px 6px; border-radius:4px;">ENTREGAR YA</span>' : ''}
            </div>
        `;
        ordersDiv.appendChild(div);
    });
    console.log('Pedidos del empleado renderizados exitosamente');
}

// ========== EMPLEADO - HISTORIAL DE PEDIDOS ==========
function filterEmployeeHistory(filter) {
    employeeHistoryFilter = filter;

    // Actualizar botones activos
    document.querySelectorAll('#historial-pedidos .filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    renderEmployeeOrderHistory(filter);
}

function renderEmployeeOrderHistory(filter = 'all') {
    const historyDiv = document.getElementById('employee-order-history');
    if (!historyDiv) return;

    historyDiv.innerHTML = '';

    if (!currentUser) return;

    let myOrders = pendingOrders.filter(o => o.employee === currentUser.username);

    // Aplicar filtro de fecha
    const now = new Date();
    if (filter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        myOrders = myOrders.filter(o => new Date(o.created_at) >= today);
    } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        myOrders = myOrders.filter(o => new Date(o.created_at) >= weekAgo);
    }

    if (myOrders.length === 0) {
        historyDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem; grid-column: 1/-1;">No hay historial en este periodo</p>';
        return;
    }

    myOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    myOrders.forEach((order) => {
        const div = document.createElement('div');
        const statusKey = order.status.toLowerCase().replace(' ', '-');
        div.className = `order-card-compact ${statusKey}`;

        const itemsList = order.items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

        div.innerHTML = `
            <div class="order-card-header">
                <h4>Pedido #${order.id}</h4>
                <div class="order-card-status" style="font-size:0.6rem; background:var(--bg-primary);">${order.status}</div>
            </div>
            <ul class="order-card-items" style="max-height:60px;">${itemsList}</ul>
            <div class="order-card-footer">
                <span class="order-card-total">$${parseFloat(order.total).toFixed(2)}</span>
                <span style="font-size:0.7rem; color:var(--text-secondary)">${new Date(order.created_at).toLocaleDateString()}</span>
            </div>
        `;
        historyDiv.appendChild(div);
    });

    // Mostrar estadísticas del empleado (se mantiene la lógica pero con mejor diseño en styles.css si existe, o inline corregido)
    const totalPedidos = myOrders.length;
    const totalVentas = myOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const pedidosCobrados = myOrders.filter(o => o.status === 'Cobrado').length;

    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'grid-column: 1 / -1; background: var(--header-bg); color: white; padding: 1.5rem; border-radius: 12px; margin-top: 1rem; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; gap: 1rem;';
    statsDiv.innerHTML = `
        <div><h2 style="margin:0;">${totalPedidos}</h2><p style="margin:0; font-size:0.8rem; opacity:0.8;">Pedidos</p></div>
        <div><h2 style="margin:0;">$${totalVentas.toFixed(0)}</h2><p style="margin:0; font-size:0.8rem; opacity:0.8;">Ventas</p></div>
        <div><h2 style="margin:0;">${pedidosCobrados}</h2><p style="margin:0; font-size:0.8rem; opacity:0.8;">Cobrados</p></div>
    `;
    historyDiv.appendChild(statsDiv);
}

// Función para reproducir sonido de notificación (opcional)
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2jdXvx3QpBSh+zPDajzsKFGCz6OyrWBQLSKDf8sFuJAUuhM/z1YU2Bxdpu+zpoVIRC0yl4fG5ZRwFN43V78d0KQUofszw2o87ChRgs+jsq1gVC0ig3/LBbiQFLoTP89WFNgcXabvs6aFSEQtMpeHxuWUcBTaN1e/HdCkFKH7M8NqPOwoUYLPo7KtYFQtIoN/ywW4kBS6Ez/PVhTYHF2m77OmhUhELTKXh8bllHAU2jdXvx3QpBSh+zPDajzsKFGCz6OyrWBULSKDf8sFuJAUuhM/z1YU2Bxdpu+zpoVIRC0yl4fG5ZRwFNo3V78d0KQUofszw2o87ChRgs+jsq1gVC0ig3/LBbiQFLoTP89WFNgcXabvs6aFSEQtMpeHxuWUcBTaN1e/HdCkFKH7M8NqPOwoUYLPo7KtYFQtIoN/ywW4kBS6Ez/PVhTYHF2m77OmhUhELTKXh8bllHAU2jdXvx3QpBSh+zPDajzsKFGCz6OyrWBULSKDf8sFuJAUuhM/z1YU2Bxdpu+zpoVIRC0yl4fG5ZRwFNo3V78d0KQUofszw2o87ChRgs+jsq1gVC0ig3/LBbiQFLoTP89WFNgcXabvs6aFSEQtMpeHxuWUcBTaN1e/HdCkFKH7M8NqPOwoUYLPo7KtYFQtIoN/ywW4kBS6Ez/PVhTYHF2m77OmhUhELTKXh8bllHAU2jdXvx3QpBSh+zPDajzsKFGCz6OyrWBULSKDf8sFuJAUuhM/z1YU2Bxdpu+zpoVIRC0yl4fG5ZRwFNo3V78d0KQUofszw2o87ChRgs+jsq1gVC0ig3/LBbiQFLoTP89WFNgcXabvs6aFSEQtMpeHxuWUcBTaN1e/HdCkFKH7M8NqPOwoUYLPo7KtYFQtIoN/ywW4kBS6Ez/PVhTYHF2m77OmhUhELTKXh8bllHAU2jdXvx3QpBSh+zPDajzsKFGCz6OyrWBULSKDf8sFuJAUuhM/z1YU2Bxdpu+zpoVIRC0yl4fG5ZRwFNo3V78d0KQUofszw2o87ChRgs+jsq1gVC0ig3/LBbiQFLoTP89WFNgcXabvs6aFSEQ==');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('No se pudo reproducir sonido:', e));
    } catch (error) {
        console.log('Error reproduciendo sonido:', error);
    }
}

// ========== REPORTES (MEJORA #3 Y FASE 4) ==========
let salesChartInstance = null;
let topProductsChartInstance = null;

async function generateReports(period = 'all') {
    try {
        let allOrders = await posApi.getOrders();

        // Filtrar por periodo
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        if (period === 'today') {
            allOrders = allOrders.filter(o => new Date(o.created_at) >= startOfDay);
        } else if (period === 'week') {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            allOrders = allOrders.filter(o => new Date(o.created_at) >= lastWeek);
        } else if (period === 'month') {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            allOrders = allOrders.filter(o => new Date(o.created_at) >= lastMonth);
        }

        // Estadísticas generales
        const totalOrders = allOrders.length;
        const totalSales = allOrders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Pedidos por estado
        const ordersByStatus = {
            'Pendiente': allOrders.filter(o => o.status === 'Pendiente').length,
            'En Preparación': allOrders.filter(o => o.status === 'En Preparación').length,
            'Finalizado': allOrders.filter(o => o.status === 'Finalizado').length,
            'Cobrado': allOrders.filter(o => o.status === 'Cobrado').length
        };

        // Productos más vendidos
        const productCount = {};
        allOrders.forEach(order => {
            if (!order.items) return;
            order.items.forEach(item => {
                const quantity = item.quantity || 1;
                if (productCount[item.name]) {
                    productCount[item.name] += quantity;
                } else {
                    productCount[item.name] = quantity;
                }
            });
        });

        const topProducts = Object.entries(productCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Ventas por empleado
        const salesByEmployee = {};
        allOrders.forEach(order => {
            const empName = order.employee || order.username || 'Sistema';
            if (salesByEmployee[empName]) {
                salesByEmployee[empName].count++;
                salesByEmployee[empName].total += (parseFloat(order.total) || 0);
            } else {
                salesByEmployee[empName] = {
                    count: 1,
                    total: (parseFloat(order.total) || 0)
                };
            }
        });

        // Configurar los gráficos de Chart.js
        const chartColors = ['#FF6B35', '#4CAF50', '#3498DB', '#9C27B0', '#F1C40F'];

        // Datos para gráfico de top productos
        const topProductsLabels = topProducts.map(p => p[0]);
        const topProductsData = topProducts.map(p => p[1]);

        // Datos para gráfico de ventas (últimos 7 días)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const salesData = last7Days.map(date => {
            return allOrders
                .filter(o => o.created_at && o.created_at.startsWith(date))
                .reduce((sum, o) => sum + parseFloat(o.total), 0);
        });

        // Renderizar reportes textuales
        const statsDashboard = document.getElementById('stats-dashboard');
        if (statsDashboard) {
            statsDashboard.innerHTML = `
                <div class="card" style="padding: 1.5rem;">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0;">📦 Total de Pedidos</h3>
                    <p style="font-size: 2rem; font-weight: bold; color: var(--primary-color); margin: 0.5rem 0;">${totalOrders}</p>
                </div>
                <div class="card" style="padding: 1.5rem;">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0;">💰 Ventas Totales</h3>
                    <p style="font-size: 2rem; font-weight: bold; color: var(--success-color); margin: 0.5rem 0;">$${totalSales.toFixed(2)}</p>
                </div>
                <div class="card" style="padding: 1.5rem;">
                    <h3 style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0;">📈 Ticket Promedio</h3>
                    <p style="font-size: 2rem; font-weight: bold; color: var(--info-color); margin: 0.5rem 0;">$${avgOrderValue.toFixed(2)}</p>
                </div>
            `;
        }

        // Renderizar Gráficos Chart.js
        setTimeout(() => {
            const isDark = document.body.classList.contains('dark-mode');
            const textColor = isDark ? '#94A3B8' : '#64748B';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

            const ctxSales = document.getElementById('salesChart');
            if (ctxSales) {
                if (salesChartInstance) salesChartInstance.destroy();
                salesChartInstance = new Chart(ctxSales, {
                    type: 'line',
                    data: {
                        labels: last7Days,
                        datasets: [{
                            label: 'Ventas Diarias ($)',
                            data: salesData,
                            borderColor: '#6366F1',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { color: textColor }
                            }
                        },
                        scales: {
                            y: { grid: { color: gridColor }, ticks: { color: textColor } },
                            x: { grid: { color: gridColor }, ticks: { color: textColor } }
                        }
                    }
                });
            }

            const ctxProducts = document.getElementById('topProductsChart');
            if (ctxProducts) {
                if (topProductsChartInstance) topProductsChartInstance.destroy();
                topProductsChartInstance = new Chart(ctxProducts, {
                    type: 'doughnut',
                    data: {
                        labels: topProductsLabels,
                        datasets: [{
                            data: topProductsData,
                            backgroundColor: chartColors,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: textColor }
                            }
                        }
                    }
                });
            }
        }, 100);

        // Actualizar listas HTML secundarias
        document.getElementById('top-products').innerHTML = topProducts.map(([product, count], index) => `
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; margin-bottom: 0.5rem; border: 1px solid var(--border-color);">
                <span style="color: var(--text-primary);">${index + 1}. ${product}</span>
                <strong style="color: var(--primary-color);">${count} unidades</strong>
            </div>
        `).join('');

        document.getElementById('payment-methods-stats').innerHTML = `
            <div style="display: grid; gap: 0.75rem; margin-bottom: 1.5rem;">
                ${Object.entries(salesByEmployee).map(([employee, data]) => `
                    <div style="padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; display: flex; justify-content: space-between; border: 1px solid var(--border-color);">
                        <strong style="color: var(--text-primary);">Empleado: ${employee}</strong>
                        <span style="color: var(--secondary-color); font-weight: 600;">$${data.total.toFixed(2)} (${data.count} pedidos)</span>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (error) {
        console.error('Error generando reportes:', error);
        alert('Error al generar reportes: ' + error.message);
    }
}

function filterReports(period) {
    // Actualizar botones UI
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${period}'`));
    });
    generateReports(period);
}

async function generateCashReport() {
    const reportDiv = document.getElementById('cash-report');
    reportDiv.innerHTML = '<p>Generando corte...</p>';

    try {
        const orders = await posApi.getOrders();
        const today = new Date().toISOString().split('T')[0];
        const todaysOrders = orders.filter(o => o.created_at.startsWith(today) && o.status === 'Cobrado');

        const total = todaysOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
        const methods = {};
        todaysOrders.forEach(o => {
            methods[o.payment_method] = (methods[o.payment_method] || 0) + parseFloat(o.total);
        });

        reportDiv.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; border-left: 5px solid #2ECC71;">
                <h4>Corte de Caja - ${new Date().toLocaleDateString()}</h4>
                <p><strong>Ventas Totales:</strong> $${total.toFixed(2)}</p>
                <hr>
                <h5>Desglose por método:</h5>
                <ul>
                    ${Object.entries(methods).map(([m, val]) => `<li>${m}: $${val.toFixed(2)}</li>`).join('')}
                </ul>
                <button onclick="window.print()" class="btn-primary" style="width: auto; margin-top: 1rem;">Imprimir Ticket de Corte</button>
            </div>
        `;
    } catch (e) {
        reportDiv.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}
