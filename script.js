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
            const savedResId = localStorage.getItem('activeBranchId') || localStorage.getItem('restaurantId');
            if (savedResId) {
                const newId = parseInt(savedResId);
                // Re-unirse al socket si el ID cambió o para asegurar persistencia
                if (socket) {
                    socket.emit('joinRestaurant', newId);
                }
                currentUser.restaurant_id = newId;
                posApi.restaurantId = savedResId;

                // Restaurar el nombre de la sucursal para la cabecera
                const savedBranchName = localStorage.getItem('activeBranchName');
                if (savedBranchName) {
                    currentUser.restaurant_name = savedBranchName;
                }
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
    if (pass.length < 8) {
        loginMsg.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        return;
    }
    if (!selectedPlan) {
        loginMsg.textContent = 'Por favor selecciona un plan primero.';
        return;
    }

    // ✅ CORRECTO: Solo guardar datos en memoria, NO crear cuenta todavía
    pendingRegistration = { name, fullName, email, password: pass, plan: selectedPlan };

    // Mostrar contenedor de pago
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('pay-rest-name').textContent = name;
    document.getElementById('payment-container').style.display = 'block';

    // Renderizar botones de PayPal reales
    renderPayPalButtons();
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
        onApprove: async function (data, actions) {
            // ✅ PAGO CONFIRMADO POR PAYPAL: crear la cuenta ahora
            console.log('Suscripción aprobada por PayPal:', data.subscriptionID);
            await handlePaymentSuccess(data.subscriptionID);
        },
        onCancel: function () {
            document.getElementById('login-msg').textContent = 'Cancelaste el pago. Tu cuenta aún no ha sido creada.';
        },
        onError: function (err) {
            console.error('Error en PayPal:', err);
            document.getElementById('login-msg').textContent = 'Hubo un error al procesar el pago con PayPal. Intenta de nuevo.';
        }
    }).render('#paypal-button-container');
}

async function handlePaymentSuccess(subscriptionID) {
    if (!pendingRegistration) return;

    const loginMsg = document.getElementById('login-msg');
    loginMsg.style.color = 'var(--primary-color)';
    loginMsg.textContent = '✅ Pago confirmado. Creando tu cuenta...';

    try {
        // ✅ CREAR LA CUENTA AHORA (solo cuando el pago fue aprobado)
        const { name, fullName, email, password, plan } = pendingRegistration;
        const response = await posApi.registerRestaurant(name, email, fullName, password, plan);

        showNotification(`¡Bienvenido a FoodWeb Pro! ID de suscripción: ${subscriptionID}`);

        // Auto-login con el usuario generado por el backend
        document.getElementById('username').value = response.username;
        document.getElementById('password').value = password;

        pendingRegistration = null;
        selectedPlan = null;

        document.getElementById('payment-container').style.display = 'none';
        document.getElementById('login-form-container').style.display = 'block';
        loginMsg.textContent = '';

        await login();

    } catch (error) {
        // Si ya existe el usuario (segundo intento tras pago exitoso previo), intentar login directo
        if (error.message && error.message.toLowerCase().includes('duplicate')) {
            loginMsg.textContent = '⚠️ Tu cuenta ya existe. Por favor inicia sesión con tus credenciales.';
            loginMsg.style.color = 'orange';
            document.getElementById('payment-container').style.display = 'none';
            document.getElementById('login-form-container').style.display = 'block';
        } else {
            loginMsg.style.color = 'red';
            loginMsg.textContent = 'Pago recibido, pero hubo un error al crear tu cuenta. Contacta soporte con tu ID: ' + subscriptionID;
        }
    }
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

        // Limpiar cualquier rastro de sucursal anterior antes de setear la nueva
        localStorage.removeItem('activeBranchId');
        localStorage.removeItem('activeBranchName');

        // El backend ahora devuelve el restaurante correcto/validado en el perfil, 
        // pero para el login inicial usamos el asignado.
        posApi.restaurantId = response.user.restaurant_id;
        localStorage.setItem('restaurantId', response.user.restaurant_id);

        if (socket) {
            socket.emit('joinRestaurant', response.user.restaurant_id);
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
    updateHeaderProfile(user);

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

function updateHeaderProfile(user) {
    if (!user) return;
    const nameSpan = document.getElementById('header-user-name');
    const initialSpan = document.getElementById('header-user-initial');
    const imgElement = document.getElementById('header-user-img');

    if (nameSpan) nameSpan.textContent = user.name || user.username || 'Usuario';

    if (initialSpan) {
        initialSpan.style.display = 'block';
        initialSpan.textContent = (user.name || user.username || 'U').charAt(0).toUpperCase();
    }

    // Intentar cargar la foto de perfil
    const savedPic = localStorage.getItem('userAvatar_' + user.id);
    if (savedPic && imgElement) {
        imgElement.src = savedPic;
        imgElement.style.display = 'block';
        if (initialSpan) initialSpan.style.display = 'none';
    } else {
        if (imgElement) imgElement.style.display = 'none';
        if (initialSpan) initialSpan.style.display = 'block';
    }
}

// ========== AVATAR MODAL (UNIVERSAL) ==========
function openAvatarModal() {
    if (!currentUser) return;

    // Si ya existe, lo eliminamos
    const existingModal = document.getElementById('avatar-modal');
    if (existingModal) existingModal.remove();

    const pic = localStorage.getItem('userAvatar_' + currentUser.id);
    const initial = (currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase();

    const modal = document.createElement('div');
    modal.id = 'avatar-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
        z-index: 10000; backdrop-filter: blur(4px);
    `;

    // Validar visualizacion condicional para las variables del src y el initial

    modal.innerHTML = `
        <div style="background: var(--bg-primary); padding: 2.5rem; border-radius: 16px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 15px 50px rgba(0,0,0,0.3); border: 1px solid var(--border-color);">
            <h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 5px;">Tu Foto de Perfil</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">Personaliza cómo te ven los demás.</p>
            
            <div style="width: 120px; height: 120px; border-radius: 50%; background: var(--primary-color); color: white; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; overflow: hidden; border: 4px solid var(--bg-secondary); box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                <img id="modal-avatar-preview" src="${pic || ''}" style="width: 100%; height: 100%; object-fit: cover; display: ${pic ? 'block' : 'none'};">
                <span id="modal-avatar-initial" style="display: ${pic ? 'none' : 'block'};">${initial}</span>
            </div>
            
            <input type="file" id="modal-avatar-input" accept="image/*" style="display: none;" onchange="handleProfilePhotoUpload(event)">
            
            <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                <button onclick="document.getElementById('modal-avatar-input').click()" style="width: 100%; padding: 12px; background: var(--success-color); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">🖼️ Subir Nueva Foto</button>
                <button onclick="removeProfilePhoto()" style="width: 100%; padding: 12px; background: var(--bg-secondary); color: var(--danger-color); border: 1px solid var(--border-color); border-radius: 8px; font-weight: bold; cursor: pointer;">🗑️ Eliminar Foto</button>
                <button onclick="document.getElementById('avatar-modal').remove()" style="width: 100%; padding: 12px; background: transparent; color: var(--text-secondary); border: none; cursor: pointer; text-decoration: underline; margin-top: 0.5rem;">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function handleProfilePhotoUpload(event) {
    const file = event.target.files[0];
    if (file && currentUser) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64Str = e.target.result;
            localStorage.setItem('userAvatar_' + currentUser.id, base64Str);
            updateHeaderProfile(currentUser);

            // Actualizar vista del modal si sigue abierto
            const preview = document.getElementById('modal-avatar-preview');
            const initialSpan = document.getElementById('modal-avatar-initial');
            if (preview) {
                preview.src = base64Str;
                preview.style.display = 'block';
                if (initialSpan) initialSpan.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeProfilePhoto() {
    if (currentUser) {
        localStorage.removeItem('userAvatar_' + currentUser.id);
        updateHeaderProfile(currentUser);

        // Actualizar vista del modal
        const preview = document.getElementById('modal-avatar-preview');
        const initialSpan = document.getElementById('modal-avatar-initial');
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
            if (initialSpan) initialSpan.style.display = 'block';
        }
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
            history.pushState({ sectionId: sectionId }, '', `#${sectionId} `);
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

        // Mostrar Plan en Widget de Suscripción Interactivo
        const isPro = currentRestaurantPlan === 'pro';

        const planBadgeDetails = document.getElementById('profile-plan-badge-details');
        const planRenewal = document.getElementById('profile-plan-renewal');
        const planBadgeSide = document.getElementById('profile-plan-badge');

        if (planBadgeDetails) {
            // Nombre y Color dentro de la tarjeta
            planBadgeDetails.textContent = isPro ? 'Pro' : 'Starter';
            planBadgeDetails.style.color = isPro ? '#38bdf8' : '#4ade80';
        }

        if (planRenewal) {
            // Simular fecha de vencimiento a 30 días para AMBOS planes
            const today = new Date();
            today.setDate(today.getDate() + 30);
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            // Capitalizar la primera letra del mes
            let dateStr = today.toLocaleDateString('es-ES', options);
            dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
            planRenewal.textContent = `Próxima renovación: ${dateStr} `;
        }

        if (planBadgeSide) {
            planBadgeSide.textContent = isPro ? 'PLAN PRO' : 'PLAN BÁSICO';
            planBadgeSide.style.background = isPro ? 'rgba(99, 102, 241, 0.1)' : 'rgba(100, 116, 139, 0.1)';
            planBadgeSide.style.color = isPro ? 'var(--primary-color)' : 'var(--text-secondary)';
        }

        // Iniciales
        const names = (user.full_name || user.username).split(' ');
        const initials = names.length > 1 ? (names[0][0] + (names[1] ? names[1][0] : '')) : names[0].substring(0, 2);
        document.getElementById('profile-initials').textContent = initials.toUpperCase();

        // ========= RESTRICCIONES PLAN BÁSICO =========
        // Si es plan Básico, ocultar las pestañas de Sucursales y Reportes
        const tabSucursales = document.querySelector('.profile-tab-btn[onclick*="sucursales"]');
        const tabReportes = document.querySelector('.profile-tab-btn[onclick*="reportes"]');

        if (tabSucursales) {
            if (isPro) {
                tabSucursales.style.display = '';
                tabSucursales.title = '';
            } else {
                tabSucursales.style.display = 'none'; // Ocultar para plan Básico
            }
        }
        if (tabReportes) {
            if (isPro) {
                tabReportes.style.display = '';
                tabReportes.title = '';
            } else {
                tabReportes.style.display = 'none'; // Ocultar para plan Básico
            }
        }

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
        const btn = Array.from(document.querySelectorAll('.profile-tab-btn')).find(b => b.getAttribute('onclick').includes(`'${tabName}'`) || b.getAttribute('onclick').includes(`"${tabName}"`));
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
        // Si es mesas, cargar mesas
        if (tabName === 'mesas') {
            renderTables();
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
    justify - content: space - between;
    align - items: center;
    background: ${isCurrent ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
    padding: 1rem 1.5rem;
    border - radius: 10px;
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
    const confirmed = await showConfirmModal('Cambiar de Sucursal', `¿Deseas cambiar a la sucursal <b> "${name}"</b>? `);
    if (!confirmed) return;

    // Guardar el nuevo ID de restaurante
    localStorage.setItem('restaurantId', id);
    localStorage.setItem('activeBranchId', id); // Usar misma convención
    localStorage.setItem('activeBranchName', name); // Guardar también el nombre para el header

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

    // Mostrar modal elegante de carga en lugar de un alert feo
    showLoadingModal(`Cambiando a sucursal: ${name} `, 'Por favor espera un momento...');

    // Recargar después de un breve delay para que la animación se vea
    setTimeout(() => {
        location.reload();
    }, 800);
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
    onclick="filterByCategory('${cat}')"> ${cat === 'all' ? 'Todos' : cat}</span>
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
        <span class="icon"> ${product.img || '🍔'}</span>
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
        <div style="font-size: 2em;"> ${product.img}</div>
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
        const smartIcon = getSmartIconForProduct(name);
        await posApi.addProduct(name, price, smartIcon, newProductModifiers);
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

// ========== GESTIÓN DE MESAS ==========
async function renderTables() {
    const list = document.getElementById('tables-list');
    if (!list) return;

    list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">Cargando mesas...</div>';

    try {
        const [tablesResponse, usersResponse] = await Promise.all([
            posApi.getTables(),
            posApi.getUsers()
        ]);

        let tables = tablesResponse || [];
        // Compatibilidad si la API retorna en otra propiedad
        if (tables.data) tables = tables.data;

        let users = usersResponse || [];
        if (users.data) users = users.data;

        // Filtrar solo empleados (meseros)
        const meseros = users.filter(u => u.role === 'empleado');

        if (!tables || tables.length === 0) {
            list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem; background: var(--bg-secondary); border-radius: 12px; border: 1px dashed var(--border-color);">No hay mesas creadas. Las mesas son opcionales.</div>';
            return;
        }

        list.innerHTML = '';
        tables.forEach(table => {
            const div = document.createElement('div');
            div.className = 'card';
            div.style.cssText = 'padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; position: relative;';

            // Selector dropdown de asignación
            let selectHtml = `<select onchange="assignTableToUser(${table.id}, this.value)" style="width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9rem; cursor: pointer;">
        <option value="">🌐 Libre (Sin asignar)</option>`;
            meseros.forEach(m => {
                const selected = (table.assigned_user_id == m.id) ? 'selected' : '';
                selectHtml += `<option value = "${m.id}" ${selected}>👤 Asignada a: ${m.username}</option> `;
            });
            selectHtml += `</select> `;

            div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="margin: 0 0 0.25rem 0; color: var(--primary-color); display: flex; align-items: center; gap: 8px;">🪑 ${table.name}</h3>
                    </div>
                    <button onclick="deleteTable(${table.id}, '${table.name}')" title="Eliminar Mesa" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding: 0;" onmouseover="this.style.background='#ef4444'; this.style.color='white';" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444';">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
        <div>
            <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Asignación Exclusiva:</label>
            ${selectHtml}
        </div>
    `;
            list.appendChild(div);
        });
    } catch (error) {
        list.innerHTML = `<div style="grid-column: 1/-1; color: red;"> Error al cargar mesas: ${error.message}</div> `;
    }
}

async function addTable() {
    const nameInput = document.getElementById('new-table-name');
    const name = nameInput.value.trim();
    if (!name) {
        alert('Por favor, ingresa el nombre de la mesa (Ej: Mesa 1)');
        return;
    }

    try {
        await posApi.addTable(name, null);
        nameInput.value = '';
        renderTables();
        showNotification(`Mesa "${name}" creada con éxito.`);
    } catch (error) {
        alert('Error al crear mesa: ' + error.message);
    }
}

async function deleteTable(id, name) {
    const confirmed = await showConfirmModal('Eliminar Mesa', `¿Estás seguro de que deseas eliminar la <b> Mesa "${name}"</b>? `);
    if (!confirmed) return;

    try {
        await posApi.deleteTable(id);
        renderTables();
        showNotification(`Mesa "${name}" eliminada.`);
    } catch (error) {
        alert('Error al eliminar mesa: ' + error.message);
    }
}

async function assignTableToUser(tableId, userId) {
    try {
        await posApi.updateTable(tableId, userId || null);
        showNotification(userId ? 'Mesa reasignada a mesero' : 'Mesa liberada para todos los meseros');
    } catch (error) {
        alert('Error al reasignar mesa: ' + error.message);
        renderTables(); // Revertir select en caso de error
    }
}

// ========== LOGICA DE ICONOS INTELIGENTES ==========
function getSmartIconForProduct(name) {
    const text = name.toLowerCase();

    // Mapeo de Emojis a palabras clave
    const iconMap = [
        { icon: '🌭', keywords: ['hot', 'dog', 'dogos', 'dogo', 'perro', 'salchipo', 'salchicha'] },
        { icon: '🍔', keywords: ['burger', 'hamburguesa', 'sirloin', 'cheeseburger', 'whopper'] },
        { icon: '🌮', keywords: ['taco', 'burrito', 'quesadilla', 'nacho', 'chilaquil', 'fajitas', 'pastor'] },
        { icon: '🍕', keywords: ['pizza', 'slice', 'rebanada', 'peperoni', 'margarita'] },
        { icon: '🥤', keywords: ['coca', 'refresco', 'soda', 'agua', 'jugo', 'limonada', 'sprite', 'fanta', 'pepsi'] },
        { icon: '🍺', keywords: ['cerveza', 'beer', 'michelada', 'vino', 'caguama', 'corona', 'tecate', 'modelo'] },
        { icon: '☕', keywords: ['cafe', 'café', 'capuccino', 'americano', 'frapp', 'te', 'té', 'infusion'] },
        { icon: '🍣', keywords: ['sushi', 'rollo', 'maki', 'ramen', 'teriyaki', 'california'] },
        { icon: '🥗', keywords: ['ensalada', 'salad', 'bowl', 'vegetariano', 'vegano'] },
        { icon: '🍟', keywords: ['papa', 'papas', 'frita', 'aros', 'boneless', 'alitas', 'wings', 'snack'] },
        { icon: '🍰', keywords: ['pastel', 'crepe', 'crepa', 'helado', 'postre', 'pay', 'brownie', 'flan', 'churro'] },
        { icon: '🍗', keywords: ['pollo', 'asado', 'rostizado', 'kfc'] },
        { icon: '🥪', keywords: ['sandwich', 'sándwich', 'torta', 'lonche', 'baguette', 'panini', 'sub'] },
        { icon: '🍦', keywords: ['helado', 'nieve', 'cono', 'paleta'] }
    ];

    // Buscar si alguna palabra en el nombre incluye nuestras palabras clave
    for (const category of iconMap) {
        if (category.keywords.some(kw => text.includes(kw))) {
            return category.icon;
        }
    }

    // Icono por defecto elegante si no hace match
    return '🍽️';
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
    border - radius: 20px;
    font - size: 0.85rem;
    font - weight: 600;
    display: flex;
    align - items: center;
    gap: 0.5rem;
    box - shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
    const quantityText = quantity > 1 ? `${quantity} x ` : '';
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
            ? `<br> <small style="color: var(--primary-color);">✨ ${item.customizations.join(', ')}</small>`
            : '';

        div.innerHTML = `
        <div class="cart-item-info">
                <span style="font-size: 0.95rem;">${item.quantity}x ${item.name}</span>
                <small>$${(item.unitPrice || item.price).toFixed(2)} c/u</small>
                ${customizations}
            </div>
        <div class="cart-item-controls">
            <button class="cart-item-btn" onclick="removeFromCart(${index})" style="background:transparent; color:var(--danger-color); border:none; cursor:pointer; font-size: 1.4rem; padding: 0.2rem 0.5rem;">×</button>
        </div>
    `;
        cartDiv.appendChild(div);
    });

    const totalDisplay = document.getElementById('cart-total-display');
    if (totalDisplay) {
        totalDisplay.textContent = `$${total.toFixed(2)} `;
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
        showNotification(`Cantidad actualizada: ${item.quantity}x ${item.name} `);
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
        showNotification(`Cantidad actualizada: ${item.quantity}x ${item.name} `);
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
        // Verificar si hay mesas activas y si toca seleccionarlas
        const tablesResponse = await posApi.getTables();
        let tables = tablesResponse || [];
        if (tables.data) tables = tables.data;

        // Si hay mesas creadas en el sistema, forzar la selección, filtrando a las disponibles
        if (tables.length > 0) {
            // Regla de Negocio: Obtener las mesas asignadas específicamente a este empleado
            const myAssignedTables = tables.filter(t => t.assigned_user_id == currentUser.id);
            let availableTables = [];

            if (myAssignedTables.length > 0) {
                // Si el dueño me asignó mesas, SOLO veo las mías (las demás se me ocultan)
                availableTables = myAssignedTables;
            } else {
                // Si no me han asignado mesas específicas, entonces puedo ver y atender en las mesas "generales" (que no tienen asignación)
                availableTables = tables.filter(t => !t.assigned_user_id);
            }

            if (availableTables.length === 0) {
                // Si el restaurante tiene mesas pero NINGUNA está libre ni asignada a este usuario, entonces no le pedimos mesa.
                // Lo enviamos directo como un pedido "en mostrador" o "para llevar".
                await processFinalOrder(null);
                return;
            }

            // Crear Modal Dinámico para Seleccionarla
            const selectedTable = await showTableSelectionModal(availableTables);
            if (!selectedTable) return; // Cancelado

            await processFinalOrder(selectedTable);
        } else {
            // Sin mesas en el sistema (comportamiento normal viejo)
            await processFinalOrder(null);
        }
    } catch (error) {
        alert('Error verificando mesas: ' + error.message);
    }
}

async function processFinalOrder(table_name) {
    try {
        const order = await posApi.createOrder(
            currentUser.username,
            cart,
            total,
            'Pendiente',
            table_name
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

function showTableSelectionModal(tables) {
    return new Promise((resolve) => {
        // Crear overlay oscuro
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        `;

        // Crear card
        const card = document.createElement('div');
        card.style.cssText = `
            background: var(--bg-primary); width: 90%; max-width: 400px;
            border-radius: 12px; padding: 1.5rem; text-align: center;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            color: var(--text-primary);
        `;

        let selectHtml = `<select id="modal-table-select" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 2px solid var(--primary-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 1rem; margin-bottom: 1.5rem; cursor: pointer;">
        <option value="" disabled selected>-- Elige una mesa --</option>`;
        tables.forEach(t => {
            selectHtml += `<option value = "${t.name}">🪑 ${t.name}</option> `;
        });
        selectHtml += `</select> `;

        card.innerHTML = `
        <h3 style="margin-top: 0; color: var(--primary-color);"> Selecciona tu Mesa</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Para enviar la orden, es necesario indicar la mesa.</p>
            ${selectHtml}
    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
        <button id="btn-cancel-table" style="flex: 1; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-weight: bold;">Cancelar</button>
        <button id="btn-confirm-table" class="btn-primary" style="flex: 1; padding: 0.8rem; border-radius: 8px;">Enviar Orden</button>
    </div>
    `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const closeMenu = (result) => {
            document.body.removeChild(overlay);
            resolve(result);
        };

        document.getElementById('btn-cancel-table').onclick = () => closeMenu(null);
        document.getElementById('btn-confirm-table').onclick = () => {
            const val = document.getElementById('modal-table-select').value;
            if (!val) {
                alert('Debes seleccionar una mesa');
                return;
            }
            closeMenu(val);
        };
    });
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
        div.className = `order - card - compact ${order.status.toLowerCase().replace(' ', '-')} `;

        const times = calculateOrderTimes(order.id);
        const timeBadge = order.status === 'Pendiente'
            ? `<div class="order-card-status" style="background:#fff3e0; color:#e65100;">⏳ ${formatCountdown(times.startInSeconds)}</div> `
            : (order.status === 'En Preparación' ? `<div class="order-card-status" style="background:#e3f2fd; color:#1565c0;">🔥 ${formatCountdown(times.readyInSeconds)}</div> ` : ` <div class="order-card-status" style="background:#e8f5e9; color:#2e7d32;">✅ LISTO</div> `);

        const itemsList = order.items.map(i => `<li> ${i.quantity}x ${i.name}</li> `).join('');

        div.innerHTML = `
        <div class="order-card-header">
            <div>
                <h4>Pedido #${order.id}</h4>
                <small style="color:var(--text-secondary)">${order.employee || 'Admin'}${order.table_name ? ` • <span style="color:var(--primary-color); font-weight:bold;">🪑 ${order.table_name}</span>` : ''}</small>
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

                const itemsStr = order.items.map(i => `${i.quantity}x ${i.name} `).join(', ');

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
        div.className = `card order - card - kitchen ${order.status === 'En Preparación' ? 'preparing-glow' : ''} `;
        div.style.borderLeft = order.status === 'En Preparación' ? '8px solid #3498db' : '8px solid #ff6b35';
        div.style.padding = '1.5rem';

        const itemsList = order.items.map(item => {
            const quantity = item.quantity || 1;
            const custom = item.customizations && item.customizations.length > 0 ? `<br> <small style="color:red">(!) ${item.customizations.join(', ')}</small>` : '';
            return `<li style="margin-bottom: 0.5rem; font-size: 1.1rem;"> <strong>${quantity}x</strong> ${item.name}${custom}</li> `;
        }).join('');

        const isPreparing = order.status === 'En Preparación';
        const timeBadge = isPreparing
            ? `<span class="countdown-badge" data-order-id="${order.id}" style="background: #3498db; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">🔥 PREPARANDO - ~${formatCountdown(times.readyInSeconds)}</span> `
            : `<span class="countdown-badge" data-order-id="${order.id}" style="background: #ff6b35; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem;">⏳ EN ESPERA - ~${formatCountdown(times.startInSeconds)}</span> `;

        div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
                <h3 style="margin: 0; color: var(--text-primary);">Pedido #${order.id}</h3>
                <small style="color: var(--text-secondary);">${order.employee || 'Mesero'}${order.table_name ? ` • <strong style="color:var(--primary-color); font-size:1rem;">🪑 ${order.table_name}</strong>` : ''}</small>
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
        showNotification(`Pedido #${orderId} actualizado a: ${newStatus} `);
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

        const itemsList = order.items.map(i => `<li> ${i.quantity}x ${i.name}</li> `).join('');

        div.innerHTML = `
        <div class="order-card-header">
                <div>
                    <h4>Pedido #${order.id}</h4>
                    <small style="color:var(--text-secondary)">${order.employee || 'Anónimo'}${order.table_name ? ` • <span style="color:var(--primary-color); font-weight:bold;">🪑 ${order.table_name}</span>` : ''}</small>
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
    width: 100 %;
    height: 100 %;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    justify - content: center;
    align - items: center;
    z - index: 10000;
    backdrop - filter: blur(5px);
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-primary); padding: 2.5rem; border-radius: 16px; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
            <h3 style="color: #FF6B35; margin-bottom: 1.5rem; text-align: center;">💰 Cobrar Pedido #${orderId}</h3>
            
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #1a252f;"><strong>Total a cobrar:</strong></p>
                <p style="font-size: 2rem; font-weight: 700; color: #FF6B35; margin: 0;">$${parseFloat(total).toFixed(2)}</p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Método de Pago:</label>
                <select id="payment-method" onchange="handlePaymentMethodChange(${total})" style="width: 100%; padding: 1rem; border: 2px solid #FF6B35; border-radius: 8px; font-size: 1.1rem; font-weight: 600; background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;">
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
        const changeMsg = change > 0 ? ` Cambio: $${change.toFixed(2)} ` : '';
        showNotification(`Pedido #${orderId} cobrado con ${paymentMethod}.${changeMsg} `);

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

        const itemsList = order.items.map(i => `<li> ${i.quantity}x ${i.name}</li> `).join('');

        div.innerHTML = `
        <div class="order-card-header">
                <div>
                    <h4>Pedido #${order.id}</h4>
                    <small style="color:var(--text-secondary)">${order.employee || 'Anónimo'}${order.table_name ? ` • <span style="color:var(--primary-color); font-weight:bold;">🪑 ${order.table_name}</span>` : ''}</small>
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
        <h4> Ticket #${ticket.id} - Pedido #${ticket.order_id}</h4>
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
            ? `${quantity}x ${item.name}${customText} @$${unitPrice.toFixed(2)} = $${item.price.toFixed(2)} `
            : `${item.name}${customText} - $${item.price.toFixed(2)} `;
        return `<li style="margin-bottom: 5px;"> ${displayText}</li> `;
    }).join('');

    // Determinar el icono del método de pago
    let paymentIcon = '💵';
    if (paymentMethod === 'Tarjeta') paymentIcon = '💳';
    else if (paymentMethod === 'Transferencia') paymentIcon = '📱';

    // Cargar textos personalizados si existen (o usar defaults enriquecidos guiados por el layout térmico clásico)
    const defaultHeader = `
        <h3 style="margin: 0; font-size: 1.2rem; text-transform: uppercase;"> NOMBRE DE TU NEGOCIO</h3>
        <p style="margin: 0; font-size: 0.8rem;">Calle Falsa 123, Colonia Centro</p>
        <p style="margin: 0; font-size: 0.8rem;">Ciudad, Estado, C.P. 12345</p>
        <p style="margin: 0; font-size: 0.8rem;">RFC: XXXX-000000-XXX</p>
        <p style="margin: 0; font-size: 0.8rem;">Tel: 55 1234 5678</p>
        <br>
        <p style="margin: 0; font-weight: bold; font-size: 1rem;">TICKET DE VENTA</p>
    `;
    const savedHeader = localStorage.getItem('ticketHeader') || defaultHeader;
    const savedFooter = localStorage.getItem('ticketFooter') || `<p style="margin: 0;">¡Gracias por su preferencia!</p><p style="margin: 0;">🌭 Vuelva pronto 🌭</p>`;
    contentDiv.innerHTML = `
        <div style="font-family: 'Courier New', Courier, monospace; color: #000; text-align: left; font-size: 0.95rem; line-height: 1.4;">
            <div style="text-align: center; margin-bottom: 10px;">
                ${savedHeader}
            </div>
            
            <p style="margin: 5px 0;"><strong>Pedido #${order.id}</strong></p>
            <p style="margin: 5px 0;">Atendido por: ${order.employee || order.username || 'Cajero'}</p>
            ${order.table_name ? `<p style="font-size: 1.1rem; border: 1px dashed #000; padding: 4px; text-align: center; margin: 10px 0;"><strong>🪑 MESA: ${order.table_name}</strong></p>` : ''}
            <p style="margin: 5px 0;">${new Date(order.created_at || Date.now()).toLocaleString()}</p>
            
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            
            <ul style="list-style: none; padding: 0; margin: 0;">${itemsList}</ul>
            
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            
            <p style="margin: 5px 0; font-size: 1.1rem;"><strong>Total: $${parseFloat(order.total).toFixed(2)}</strong></p>
            <p style="margin: 5px 0;">Modo Pago: ${paymentIcon} ${paymentMethod}</p>
            <p style="margin: 5px 0;">Recibido: $${parseFloat(amountReceived).toFixed(2)}</p>
            ${changeGiven > 0 ? `<p style="margin: 5px 0;"><strong>Cambio: $${parseFloat(changeGiven).toFixed(2)}</strong></p>` : ''}
            
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            
            <div style="text-align: center; margin-top: 10px;">
                ${savedFooter}
            </div>
        </div>
    `;

    // Asegurarse de que el ticket sea visible y parezca un ticket término realista
    receiptDiv.style.display = 'flex';
    receiptDiv.style.flexDirection = 'column';
    receiptDiv.style.position = 'fixed';
    receiptDiv.style.top = '50%';
    receiptDiv.style.left = '50%';
    receiptDiv.style.transform = 'translate(-50%, -50%)';
    receiptDiv.style.zIndex = '10001';
    receiptDiv.style.background = '#fff';
    receiptDiv.style.padding = '0';
    receiptDiv.style.borderRadius = '0';
    receiptDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    receiptDiv.style.width = '300px'; // Ancho típico de ticket 80mm
    receiptDiv.style.maxHeight = '90vh';
    receiptDiv.style.overflowY = 'auto';

    console.log('Ticket mostrado correctamente');
}

function printReceipt() {
    window.print();
}

function cancelReceipt() {
    document.getElementById('receipt').style.display = 'none';
}

// ========== CONFIGURACIÓN DE TICKET ==========
function openTicketConfigModal() {
    let modal = document.getElementById('ticket-config-modal');
    if (modal) modal.remove();

    const defaultHeader = `
        <h3 style="margin: 0; font-size: 1.2rem; text-transform: uppercase;">NOMBRE DE TU NEGOCIO</h3>
        <p style="margin: 0; font-size: 0.8rem;">Calle Falsa 123, Colonia Centro</p>
        <p style="margin: 0; font-size: 0.8rem;">Ciudad, Estado, C.P. 12345</p>
        <p style="margin: 0; font-size: 0.8rem;">RFC: XXXX-000000-XXX</p>
        <p style="margin: 0; font-size: 0.8rem;">Tel: 55 1234 5678</p>
        <br>
        <p style="margin: 0; font-weight: bold; font-size: 1rem;">TICKET DE VENTA</p>
    `;
    const defaultFooter = `<p style="margin: 0;">¡Gracias por su preferencia!</p><p style="margin: 0;">🌭 Vuelva pronto 🌭</p>`;

    const savedHeader = localStorage.getItem('ticketHeader') || defaultHeader;
    const savedFooter = localStorage.getItem('ticketFooter') || defaultFooter;

    modal = document.createElement('div');
    modal.id = 'ticket-config-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.75); display: flex; justify-content: center; align-items: center;
        z-index: 10000; backdrop-filter: blur(5px);
    `;

    modal.innerHTML = `
        <div style="background: var(--bg-primary); padding: 2.5rem; border-radius: 16px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <h2 style="margin-top: 0; color: var(--primary-color);">⚙️ Configurar Ticket Térmico</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Edita el modelo base que aparecerá en la cabecera y el pie de página de todos los tickets generados.</p>
            
            <label style="font-weight: bold; display: block; margin-bottom: 5px; color: var(--text-primary);">Encabezado del Ticket:</label>
            <div id="config-header-editor" contenteditable="true" style="border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; padding: 15px; min-height: 150px; margin-bottom: 20px; font-family: 'Courier New', monospace; font-size: 14px; background: var(--bg-secondary);">
                ${savedHeader}
            </div>
            
            <label style="font-weight: bold; display: block; margin-bottom: 5px; color: var(--text-primary);">Pie de Página del Ticket:</label>
            <div id="config-footer-editor" contenteditable="true" style="border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; padding: 15px; min-height: 100px; margin-bottom: 20px; font-family: 'Courier New', monospace; font-size: 14px; background: var(--bg-secondary);">
                ${savedFooter}
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; flex-wrap: wrap;">
                <button onclick="document.getElementById('ticket-config-modal').remove()" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; background: #e0e0e0; font-weight: bold; flex: 1; min-width: 100px;">Cancelar</button>
                <button onclick="resetTicketConfig()" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; background: #e74c3c; color: white; font-weight: bold; flex: 1; min-width: 130px;">Restaurar Default</button>
                <button onclick="saveTicketConfig()" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; background: var(--primary-color); color: white; font-weight: bold; flex: 1; min-width: 140px;">Guardar Cambios</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveTicketConfig() {
    const headerHtml = document.getElementById('config-header-editor').innerHTML;
    const footerHtml = document.getElementById('config-footer-editor').innerHTML;
    localStorage.setItem('ticketHeader', headerHtml);
    localStorage.setItem('ticketFooter', footerHtml);
    document.getElementById('ticket-config-modal').remove();
    showNotification('Diseño de Ticket guardado 🖨️');
}

function resetTicketConfig() {
    if (confirm('¿Restaurar el diseño base? Perderás tus cambios actuales.')) {
        localStorage.removeItem('ticketHeader');
        localStorage.removeItem('ticketFooter');
        document.getElementById('ticket-config-modal').remove();
        openTicketConfigModal();
        showNotification('Diseño restaurado');
    }
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
                flex-direction: column;
                padding: 1rem;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                margin-bottom: 0.5rem;
            `;

            const roleIcons = {
                'admin': '🛡️',
                'caja': '💰',
                'empleado': '🏃',
                'cocinero': '👨‍🍳'
            };
            const icon = roleIcons[user.role] || '👤';

            const isNotAdmin = user.role !== 'admin';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                        <div style="width: 42px; height: 42px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                            ${icon}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="margin:0; font-size: 1.1rem; color: var(--text-primary); word-break: break-word; line-height: 1.2;" title="${user.username}">${user.username}</h4>
                            <p style="margin:2px 0 0 0; font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">${user.role.toUpperCase()}</p>
                        </div>
                    </div>
                    <div title="Usuario Activo" style="display: flex; align-items: center; justify-content: center; color: #2ecc71; background: rgba(46, 204, 113, 0.1); width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
                ${isNotAdmin ? `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                    ${user.password ? `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span id="pwd-text-${user.id}" style="font-family: monospace; font-size: 0.9rem; color: var(--text-secondary); background: rgba(0,0,0,0.1); padding: 4px 8px; border-radius: 6px; letter-spacing: 2px;">••••••••</span>
                        <button onclick="togglePassword(${user.id}, '${user.password}')" title="Mostrar/Ocultar contraseña" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; color: var(--text-secondary); padding: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='var(--primary-color)'; this.style.color='white'; this.style.borderColor='var(--primary-color)';" onmouseout="this.style.background='var(--bg-secondary)'; this.style.color='var(--text-secondary)'; this.style.borderColor='var(--border-color)';">
                            <svg id="pwd-icon-${user.id}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    </div>` : `<div></div>`}
                    
                    <button onclick="deleteEmployee(${user.id}, '${user.username}')" title="Eliminar usuario" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; width: 34px; height: 34px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; padding: 0;" onmouseover="this.style.background='#ef4444'; this.style.color='white';" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'; this.style.color='#ef4444';">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>` : ''}
            `;
            employeeList.appendChild(div);
        });
    } catch (error) {
        console.error('Error cargando empleados:', error);
    }
}

// Mostrar/Ocultar contraseña en lista de empleados
function togglePassword(userId, password) {
    const textSpan = document.getElementById(`pwd-text-${userId}`);
    const iconSvg = document.getElementById(`pwd-icon-${userId}`);

    if (textSpan.dataset.vis === 'true') {
        textSpan.dataset.vis = 'false';
        textSpan.textContent = '••••••••';
        textSpan.style.letterSpacing = '2px';
        iconSvg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    } else {
        textSpan.dataset.vis = 'true';
        textSpan.textContent = password;
        textSpan.style.letterSpacing = 'normal';
        iconSvg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    }
}

// Eliminar un empleado
async function deleteEmployee(userId, username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al empleado "${username}"?`)) {
        return;
    }

    try {
        await posApi.deleteUser(userId);
        showNotification(`Empleado "${username}" eliminado`);
        renderEmployees(); // Recargar lista
    } catch (error) {
        alert('Error al eliminar empleado: ' + error.message);
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
        // En Producción (PostgreSQL), la columna 'username' es UNIQUE a nivel global.
        // Para evitar que diferentes restaurantes no puedan crear un "mesero1", 
        // usaremos un prefijo interno: r[IdRestaurante]_[username] 
        // Si el usuario es el admin, no modificamos su nombre (ya se creó en el registro)
        const restId = posApi.restaurantId || currentUser.restaurant_id || currentUser.id;
        const prefixedUsername = `r${restId}_${username.toLowerCase().replace(/\s+/g, '')}`;

        // Obtener lista actual de usuarios DE ESTA SUCURSAL para validaciones
        const users = await posApi.getUsers();

        // 1. Validar que el nombre de usuario NO exista ya EN ESTE RESTAURANTE
        // Comparamos usando el prefijado para mayor seguridad
        const usernameExists = users.some(u =>
            u.username.toLowerCase() === prefixedUsername ||
            u.username.toLowerCase() === username.toLowerCase() // por si hubiera antiguos sin prefijo
        );

        if (usernameExists) {
            empMsg.style.color = 'orange';
            empMsg.innerHTML = '⚠️ Este nombre de usuario <b>ya está en uso en tu sucursal</b>. Por favor, elige otro.';
            return;
        }

        // ========= RESTRICCIONES PLAN BÁSICO =========
        if (currentRestaurantPlan !== 'pro') {
            if (role === 'caja') {
                // LÍMITE: máximo 1 cajero
                const cajaUsers = users.filter(u => u.role === 'caja');
                if (cajaUsers.length >= 1) {
                    empMsg.style.color = 'orange';
                    empMsg.innerHTML = '⚠️ <strong>Plan Básico:</strong> Solo se permite 1 cajero. Actualiza al Plan Pro para más.';
                    return;
                }
            } else if (role === 'empleado' || role === 'cocinero') {
                // LÍMITE: máximo 2 empleados operativos (meseros / cocineros independientemente de la caja)
                const operativos = users.filter(u => u.role === 'empleado' || u.role === 'cocinero');
                if (operativos.length >= 2) {
                    empMsg.style.color = 'orange';
                    empMsg.innerHTML = '⚠️ <strong>Plan Básico:</strong> Límite de 2 empleados (Mesero/Cocinero) alcanzado. Actualiza al Plan Pro para más.';
                    return;
                }
            }
        }

        // Crear usando el nombre prefijado para asegurar que sea único globalmente
        await posApi.addUser(prefixedUsername, password, role);
        document.getElementById('new-emp-username').value = '';
        document.getElementById('new-emp-password').value = '';
        empMsg.innerHTML = ''; // Limpiar cualquier mensaje de error anterior
        empMsg.style.color = '';

        // Mostrar un modal moderno y elegante en lugar de alert nativo
        showSuccessModal(prefixedUsername, password);

        renderEmployees();
    } catch (error) {
        // Mejorar los errores crudos de PostgreSQL
        if (error.message && error.message.toLowerCase().includes('duplicate key')) {
            empMsg.style.color = 'orange';
            empMsg.innerHTML = '⚠️ Error interno de base de datos (nombre duplicado). Intenta añadir números o letras a este nombre.';
        } else {
            empMsg.textContent = 'Error: ' + error.message;
            empMsg.style.color = 'red';
        }
    }
}

// ========== MODAL ÉXITO CREAR EMPLEADO ==========
function showSuccessModal(username, password) {
    // Si ya existe un modal anterior, eliminarlo para no duplicar
    const existingModal = document.getElementById('success-employee-modal');
    if (existingModal) existingModal.remove();

    const isDark = document.body.classList.contains('dark-mode');
    const modal = document.createElement('div');
    modal.id = 'success-employee-modal';

    // Contenedor principal del modal (overlay)
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 10005;
        opacity: 0; transition: opacity 0.3s;
    `;

    // Tarjeta del modal
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const borderColor = isDark ? '#334155' : '#e2e8f0';

    modal.innerHTML = `
        <div style="
            background: ${cardBg}; 
            color: ${textColor};
            padding: 2.5rem; 
            border-radius: 16px; 
            max-width: 400px; 
            width: 90%; 
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); 
            border: 1px solid ${borderColor};
            transform: translateY(20px) scale(0.95);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        " id="success-employee-card">
            
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
            <h3 style="margin-top: 0; font-size: 1.5rem; color: var(--primary-color);">¡Empleado Creado!</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.95rem;">
                Tu empleado ha sido agregado exitosamente. Para evitar colisiones en la plataforma, 
                comparte las siguientes credenciales exactas:
            </p>
            
            <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--primary-color); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; text-align: left;">
                <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--text-secondary);">Usuario de Acceso:</p>
                <p style="font-family: monospace; font-size: 1.2rem; font-weight: bold; margin: 0 0 1rem 0; color: var(--primary-color); user-select: all; cursor: pointer;" title="Doble clic para seleccionar">${username}</p>
                
                <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--text-secondary);">Contraseña:</p>
                <div style="display: flex; justify-content: space-between; align-items: center; background: ${isDark ? '#0f172a' : '#f1f5f9'}; padding: 0.5rem 0.75rem; border-radius: 4px;">
                    <p style="font-family: monospace; font-size: 1rem; margin: 0; user-select: all;">${password.replace(/./g, '•')}</p>
                </div>
            </div>

            <button onclick="document.getElementById('success-employee-modal').remove()" 
                    style="width: 100%; background: var(--primary-color); color: white; border: none; padding: 1rem; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: filter 0.2s;">
                Entendido
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Animaciones de entrada
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        const card = document.getElementById('success-employee-card');
        if (card) card.style.transform = 'translateY(0) scale(1)';
    });
}

// ========== MODALES REUSABLES ELEGANTES ==========
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('custom-confirm-modal');
        if (existingModal) existingModal.remove();

        const isDark = document.body.classList.contains('dark-mode');
        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';

        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            display: flex; justify-content: center; align-items: center;
            z-index: 10005;
            opacity: 0; transition: opacity 0.3s;
        `;

        const cardBg = isDark ? '#1e293b' : '#ffffff';
        const textColor = isDark ? '#f8fafc' : '#1e293b';
        const borderColor = isDark ? '#334155' : '#e2e8f0';

        modal.innerHTML = `
            <div style="
                background: ${cardBg}; 
                color: ${textColor};
                padding: 2.5rem; 
                border-radius: 16px; 
                max-width: 400px; 
                width: 90%; 
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); 
                border: 1px solid ${borderColor};
                transform: translateY(20px) scale(0.95);
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                text-align: center;
            " id="custom-confirm-card">
                
                <div style="font-size: 3rem; margin-bottom: 1rem;">🏢</div>
                <h3 style="margin-top: 0; font-size: 1.5rem; color: var(--primary-color);">${title}</h3>
                <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 1rem;">
                    ${message}
                </p>
                
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="btn-confirm-cancel" style="flex: 1; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-secondary)';" onmouseout="this.style.background='transparent';">
                        Cancelar
                    </button>
                    <button id="btn-confirm-accept" style="flex: 1; background: var(--primary-color); color: white; border: none; padding: 0.75rem; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; transition: filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                        Aceptar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeAndResolve = (result) => {
            modal.style.opacity = '0';
            const card = document.getElementById('custom-confirm-card');
            if (card) card.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => {
                modal.remove();
                resolve(result);
            }, 300);
        };

        document.getElementById('btn-confirm-cancel').onclick = () => closeAndResolve(false);
        document.getElementById('btn-confirm-accept').onclick = () => closeAndResolve(true);

        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            const card = document.getElementById('custom-confirm-card');
            if (card) card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

function showLoadingModal(title, subtitle) {
    const existingModal = document.getElementById('custom-loading-modal');
    if (existingModal) existingModal.remove();

    const isDark = document.body.classList.contains('dark-mode');
    const modal = document.createElement('div');
    modal.id = 'custom-loading-modal';

    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 10006;
        opacity: 0; transition: opacity 0.3s;
    `;

    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const borderColor = isDark ? '#334155' : '#e2e8f0';

    modal.innerHTML = `
        <div style="
            background: ${cardBg}; 
            color: ${textColor};
            padding: 2.5rem; 
            border-radius: 16px; 
            max-width: 350px; 
            width: 90%; 
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); 
            border: 1px solid ${borderColor};
            transform: scale(0.95);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        " id="custom-loading-card">
            
            <svg style="margin: 0 auto 1.5rem auto; display: block; animation: rotate 2s linear infinite;" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            <style>@keyframes rotate { 100% { transform: rotate(360deg); } }</style>
            
            <h3 style="margin-top: 0; font-size: 1.25rem; color: var(--primary-color);">${title}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 0; font-size: 0.95rem;">
                ${subtitle}
            </p>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        const card = document.getElementById('custom-loading-card');
        if (card) card.style.transform = 'scale(1)';
    });
}

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
                <div>
                    <h4>Pedido #${order.id}</h4>
                    ${order.table_name ? `<small style="color:var(--primary-color); font-weight:bold;">🪑 ${order.table_name}</small>` : ''}
                </div>
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
                <div>
                    <h4>Pedido #${order.id}</h4>
                    ${order.table_name ? `<small style="color:var(--primary-color); font-weight:bold;">🪑 ${order.table_name}</small>` : ''}
                </div>
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

// ========== MODAL INFORMATIVO EN FOOTER ==========
function showInfoModal(titulo) {
    const modal = document.getElementById('info-modal');
    const titleEl = document.getElementById('info-modal-title');
    const bodyEl = document.getElementById('info-modal-body');

    // Mapeo de contenidos genéricos para el SaaS
    const contenidos = {
        'Funcionalidades': 'FoodWeb Pro incluye gestión de múltiples sucursales, toma de pedidos en tiempo real para meseros, panel de cocina (KDS), facturación automática y reportes de cortes de caja detallados.',
        'Planes y Precios': 'Plan Básico: 1 Sucursal, 2 Empleados, ventas ilimitadas y caja por solo $260 MXN.\nPlan Pro: Todo ilimitado y reportes gráficos por solo $499 MXN.',
        'Historias de éxito': 'Más de 50 restaurantes en toda la república han modernizado su atención al cliente con FoodWeb, reduciendo sus tiempos de espera en un 35% y erradicando el robo hormiga.',
        'Cultura': 'Creemos en la tecnología accesible para todos. Trabajamos día a día para que las pymes gastronómicas tengan herramientas de primer mundo sin costos de instalación astronómicos.',
        'Trabajá con nosotros': 'Actualmente estamos buscando Desarrolladores Frontend y Especialistas en Soporte Técnico. Envía tu currículum a talento@foodweb.pro',
        'Preguntas frecuentes': '¿Qué necesito para empezar? Solo una tablet o computadora con internet.\n\n¿Tengo plazos forzosos? Ninguno, puedes cancelar el Plan Pro en cualquier momento.\n\n¿Mis datos están seguros? Utilizamos encriptación bancaria y respaldos diarios en la nube.',
        'Refiere un restaurante': '¡Gana 1 mes de Plan Pro gratis por cada colega que refieras y contrate FoodWeb Pro! Pídeles que ingresen tu correo al momento de registrarse.',
        'Programa de partners': 'Ideal para agencias de marketing y consultores gastronómicos. Únete a nuestro programa de partners y recibe un % de comisión recurrente por las ventas que facilites.',
        'Blog': 'Visita nuestro blog en medium.com/foodweb para artículos sobre administración de restaurantes, marketing gastronómico y las últimas tendencias del sector.',
        'Centro de ayuda': 'Contamos con soporte 24/7. Si experimentas un fallo técnico o dudas sobre una función, pulsa el botón flotante de WhatsApp o escribe a soporte@foodweb.pro.',
        'Tutoriales': 'Aprende a sacarle el máximo provecho a la plataforma en nuestro canal de YouTube "FoodWeb Pro Tutoriales". Subimos videos explicativos semanales de cada herramienta.'
    };

    titleEl.textContent = titulo;
    bodyEl.innerText = contenidos[titulo] || 'Información no disponible por el momento. Regresa pronto.';

    modal.style.display = 'flex';
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========== MESAS ==========

async function renderTables() {
    const list = document.getElementById('tables-list');
    if (!list) return;

    list.innerHTML = '<p>Cargando mesas...</p>';

    try {
        const tables = await posApi.getTables();
        const users = await posApi.getUsers();

        // Filtrar usuarios operativos (meseros)
        const waiters = users.filter(u => u.role === 'empleado');

        if (tables.length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary);">No hay mesas creadas. Agrega una arriba.</p>';
            return;
        }

        list.innerHTML = '';
        tables.forEach(table => {
            const div = document.createElement('div');
            div.className = 'card';
            div.style.cssText = 'padding: 1rem; border-left: 4px solid var(--primary-color); display: flex; flex-direction: column; gap: 0.5rem;';

            let assignedText = '<span style="color:var(--text-secondary); font-size:0.85rem;">No asignada</span>';
            if (table.assigned_user_id) {
                const assignedUser = users.find(u => u.id === table.assigned_user_id);
                if (assignedUser) {
                    assignedText = `<span style="color:var(--success-color); font-weight:bold; font-size:0.85rem;">Asignada a: ${assignedUser.username}</span>`;
                }
            }

            let selectHtml = `<select onchange="assignTableToUser(${table.id}, this.value)" style="padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-color); width: 100%; background: var(--bg-primary); color: var(--text-primary); font-size: 0.85rem;">
                <option value="">-- Sin Asignar --</option>
                ${waiters.map(w => `<option value="${w.id}" ${table.assigned_user_id === w.id ? 'selected' : ''}>${w.username}</option>`).join('')}
            </select>`;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="margin: 0; font-size: 1.1rem;">🪑 ${table.name}</h4>
                    <button onclick="deleteTable(${table.id}, '${table.name}')" title="Eliminar Mesa" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
                <div>${assignedText}</div>
                <div style="margin-top: 0.5rem;">${selectHtml}</div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = `<p style="color: red;">Error: ${e.message}</p>`;
    }
}

async function addTable() {
    const nameInput = document.getElementById('new-table-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Por favor ingresa un nombre para la mesa.');
        return;
    }

    try {
        await posApi.addTable(name);
        nameInput.value = '';
        showNotification(`Mesa "${name}" agregada`);
        renderTables();
    } catch (e) {
        alert('Error al agregar mesa: ' + e.message);
    }
}

async function deleteTable(id, name) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la mesa "${name}"?`)) return;

    try {
        await posApi.deleteTable(id);
        showNotification(`Mesa "${name}" eliminada`);
        renderTables();
    } catch (e) {
        alert('Error al eliminar mesa: ' + e.message);
    }
}

async function assignTableToUser(tableId, userId) {
    try {
        await posApi.updateTable(tableId, userId || null);
        showNotification('Asignación de mesa actualizada');
        renderTables(); // Refrescar para mostrar el nuevo texto de asignación
    } catch (e) {
        alert('Error al asignar mesa: ' + e.message);
    }
}