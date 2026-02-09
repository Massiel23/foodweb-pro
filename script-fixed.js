// ========== VARIABLES GLOBALES ==========
let currentUser = null;
let products = [];
let cart = [];
let total = 0;
let taxRate = 10;
let pendingOrders = [];
let printedTickets = [];
let socket = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar Socket.IO
    initializeSocket();
    
    // Cargar configuración desde localStorage
    const savedTaxRate = localStorage.getItem('taxRate');
    if (savedTaxRate) {
        taxRate = parseFloat(savedTaxRate);
        document.getElementById('tax-rate').value = taxRate;
    }
});

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
        background: #4CAF50;
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

// ========== AUTENTICACIÓN ==========
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
        const response = await api.login(username, password);
        currentUser = response.user;
        
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        if (response.user.role === 'admin') {
            document.getElementById('nav-admin').style.display = 'block';
        } else if (response.user.role === 'caja') {
            document.getElementById('nav-caja').style.display = 'block';
        } else {
            document.getElementById('nav-empleado').style.display = 'block';
        }
        
        await loadProducts();
        await loadOrders();
        
        if (response.user.role === 'caja') {
            showSection('pendientes-cobrar');
        } else if (response.user.role === 'empleado') {
            showSection('venta');
            // Cargar pedidos del empleado
            renderEmployeePendingOrders();
            renderEmployeeOrderHistory('all');
        } else {
            showSection('venta');
        }
        
        showNotification(`Bienvenido, ${response.user.username}!`);
    } catch (error) {
        loginMsg.textContent = error.message || 'Usuario o contraseña incorrectos.';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    api.clearToken();
    
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('nav-admin').style.display = 'none';
    document.getElementById('nav-empleado').style.display = 'none';
    document.getElementById('nav-caja').style.display = 'none';
    
    cart = [];
    total = 0;
    updateCart();
}

// ========== NAVEGACIÓN ==========
function showSection(sectionId) {
    const adminSections = ['productos', 'empleados', 'pedidos', 'ajustes', 'facturacion', 'reportes'];
    const cajaSections = ['pendientes-cobrar', 'cobrados', 'tickets'];
    
    // Admin tiene acceso a TODO
    if (currentUser.role === 'admin') {
        // Admin puede acceder a cualquier sección, no hay restricciones
    } else if (currentUser.role === 'caja') {
        // Caja solo puede acceder a secciones de caja y venta
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
    
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
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
}

// ========== PRODUCTOS ==========
async function loadProducts() {
    try {
        products = await api.getProducts();
        renderProducts();
    } catch (error) {
        console.error('Error cargando productos:', error);
        showNotification('Error cargando productos');
    }
}

function renderProducts() {
    const ventaList = document.getElementById('product-list-venta');
    const adminList = document.getElementById('product-list-admin');
    
    if (ventaList) ventaList.innerHTML = '';
    if (adminList) adminList.innerHTML = '';
    
    products.forEach((product) => {
        const item = document.createElement('div');
        item.className = 'product-item';
        item.innerHTML = `
            <div style="font-size: 2em;">${product.img}</div>
            <h4>${product.name}</h4>
            <p>$${parseFloat(product.price).toFixed(2)}</p>
            <button onclick="addToCart(${product.id}, '${product.name}', ${product.price})">Agregar</button>
        `;
        if (ventaList) ventaList.appendChild(item.cloneNode(true));

        if (adminList) {
            const adminItem = item.cloneNode(true);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.style.backgroundColor = '#f44336';
            deleteBtn.onclick = () => removeProduct(product.id);
            adminItem.appendChild(deleteBtn);
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
        await api.addProduct(name, price, '🍔');
        document.getElementById('new-product-name').value = '';
        document.getElementById('new-product-price').value = '';
        showNotification('Producto agregado exitosamente');
        await loadProducts();
    } catch (error) {
        alert('Error al agregar producto: ' + error.message);
    }
}

async function removeProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
        await api.deleteProduct(id);
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
    modal.id = 'customization-modal';
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
        animation: fadeIn 0.3s ease;
    `;
    
    const ingredientOptions = `
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="con todo" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #2ECC71;">
            <span style="color: #2ECC71; font-weight: 700;">✅ Con Todo</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="cebolla asada" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🔥 Cebolla Asada</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin tomate" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🍅 Sin Tomate</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin cebolla" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🧅 Sin Cebolla</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin chile" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🌶️ Sin Chile</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin catsup" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🍅 Sin Catsup</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin mayonesa" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🥚 Sin Mayonesa</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin champiñón" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🍄 Sin Champiñón</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin queso rayado" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🧀 Sin Queso Rayado</span>
        </label>
        <label style="display: flex; align-items: center; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent;" onmouseover="this.style.borderColor='#FF6B35'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
            <input type="checkbox" value="sin queso amarillo" class="customization-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer; accent-color: #FF6B35;">
            <span style="color: #1a252f; font-weight: 500;">🟡 Sin Queso Amarillo</span>
        </label>
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); padding: 2.5rem; border-radius: 16px; max-width: 550px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: slideUp 0.3s ease;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3 style="color: #FF6B35; font-size: 1.8rem; margin-bottom: 0.5rem; font-weight: 700;">🌭 Personalizar Pedido</h3>
                <p style="color: #1a252f; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">${name}</p>
                <p style="color: #FF6B35; font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">$${parseFloat(price).toFixed(2)} c/u</p>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: rgba(255, 107, 53, 0.1); border-radius: 12px;">
                    <label style="color: #1a252f; font-weight: 600; font-size: 1.1rem;">Cantidad:</label>
                    <button onclick="decreaseQuantity()" style="background: #FF6B35; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 1.5rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#E55A2B'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='#FF6B35'; this.style.transform='scale(1)'">−</button>
                    <input type="number" id="quantity-input" value="1" min="1" max="99" oninput="updateQuantityDisplay(${price})" style="width: 80px; padding: 0.75rem; border: 2px solid #FF6B35; border-radius: 8px; font-size: 1.3rem; font-weight: 700; text-align: center; color: #1a252f;">
                    <button onclick="increaseQuantity()" style="background: #FF6B35; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 1.5rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#E55A2B'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='#FF6B35'; this.style.transform='scale(1)'">+</button>
                </div>
                
                <div style="background: #E8F5E9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p style="color: #2ECC71; font-weight: 700; font-size: 1.3rem; margin: 0;">Total: $<span id="quantity-total">${parseFloat(price).toFixed(2)}</span></p>
                </div>
                
                <p style="color: #4a5568; font-size: 0.95rem;">Personaliza tu pedido:</p>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; padding: 1.5rem; background: rgba(255, 255, 255, 0.8); border-radius: 12px; border: 2px solid #f0f0f0;">
                ${ingredientOptions}
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1rem; border-top: 2px solid #f0f0f0;">
                <button onclick="closeCustomizationModal()" style="background: #6c757d; color: white; border: none; padding: 0.875rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onmouseover="this.style.background='#5a6268'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'" onmouseout="this.style.background='#6c757d'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">Cancelar</button>
                <button onclick="confirmCustomization(${id}, '${name}', ${price}, event)" style="background: #FF6B35; color: white; border: none; padding: 0.875rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onmouseover="this.style.background='#E55A2B'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'" onmouseout="this.style.background='#FF6B35'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)'">✓ Agregar al Carrito</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCustomizationModal();
        }
    });
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
    
    const total = quantity * parseFloat(unitPrice);
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
    
    const unitPrice = parseFloat(price);
    const itemTotal = unitPrice * quantity;
    
    cart.push({ 
        id, 
        name, 
        unitPrice: unitPrice,
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
    const cartDiv = document.getElementById('cart');
    cartDiv.innerHTML = '';
    
    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        const customText = item.customizations && item.customizations.length > 0 
            ? `<br><small style="color: #FF6B35;">${item.customizations.join(', ')}</small>` 
            : '';
        
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || item.price;
        const displayText = quantity > 1 
            ? `${quantity}x ${item.name} @ $${unitPrice.toFixed(2)} = $${item.price.toFixed(2)}`
            : `${item.name} - $${item.price.toFixed(2)}`;
        
        div.innerHTML = `
            <div style="flex: 1;">
                <strong>${displayText}</strong>${customText}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${quantity > 1 ? `
                    <button onclick="decreaseCartQuant
