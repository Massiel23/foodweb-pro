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
        const user = await api.login(username, password);
        currentUser = user;
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        if (user.role === 'admin') {
            document.getElementById('nav-admin').style.display = 'block';
        } else if (user.role === 'caja') {
            document.getElementById('nav-caja').style.display = 'block';
        } else {
            document.getElementById('nav-empleado').style.display = 'block';
        }
        
        await loadProducts();
        await loadOrders();
        
        if (user.role === 'caja') {
            showSection('pendientes-cobrar');
        } else if (user.role === 'empleado') {
            showSection('venta');
            // Cargar pedidos del empleado
            renderEmployeePendingOrders();
            renderEmployeeOrderHistory('all');
        } else {
            showSection('venta');
        }
        
        showNotification(`Bienvenido, ${user.username}!`);
    } catch (error) {
        loginMsg.textContent = error.message || 'Usuario o contraseña incorrectos.';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
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
    
    if (currentUser.role !== 'admin' && adminSections.includes(sectionId)) {
        alert('Acceso denegado.');
        return;
    }
    
    if (currentUser.role !== 'caja' && currentUser.role !== 'admin' && cajaSections.includes(sectionId)) {
        alert('Acceso denegado.');
        return;
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
    if (currentUser && (currentUser.role === 'empleado' || currentUser.role === 'admin')) {
        showCustomizationModal(id, name, price);
    } else {
        cart.push({ id, name, price: parseFloat(price), customizations: [], quantity: 1, unitPrice: parseFloat(price) });
        total += parseFloat(price);
        updateCart();
        showNotification(`${name} agregado al carrito`);
    }
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
                    <button onclick="decreaseCartQuantity(${index})" style="background: #FF6B35; color: white; width: 30px; height: 30px; border-radius: 50%; font-size: 1.2rem; padding: 0; display: flex; align-items: center; justify-content: center;">−</button>
                    <span style="font-weight: 700; min-width: 30px; text-align: center;">${quantity}</span>
                    <button onclick="increaseCartQuantity(${index})" style="background: #FF6B35; color: white; width: 30px; height: 30px; border-radius: 50%; font-size: 1.2rem; padding: 0; display: flex; align-items: center; justify-content: center;">+</button>
                ` : ''}
                <button onclick="removeFromCart(${index})" style="background: #E74C3C;">🗑️</button>
            </div>
        `;
        cartDiv.appendChild(div);
    });
    
    document.getElementById('total').textContent = total.toFixed(2);
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
        const order = await api.createOrder(
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
        pendingOrders = await api.getOrders();
        console.log('Pedidos cargados:', pendingOrders);
        console.log('Número de pedidos:', pendingOrders.length);
        console.log('Usuario actual:', currentUser);
        
        renderPendingOrders();
        renderCashierPendingOrders();
        renderCashierPaidOrders();
        
        // Si es empleado, actualizar sus vistas también
        if (currentUser && currentUser.role === 'empleado') {
            console.log('Usuario es empleado, actualizando vistas de empleado...');
            renderEmployeePendingOrders();
            renderEmployeeOrderHistory(employeeHistoryFilter);
        }
        
        console.log('=== loadOrders completado ===');
    } catch (error) {
        console.error('Error cargando pedidos:', error);
        console.error('Stack trace:', error.stack);
    }
}

function renderPendingOrders() {
    const ordersDiv = document.getElementById('pending-orders');
    if (!ordersDiv) return;
    
    ordersDiv.innerHTML = '';
    
    pendingOrders.forEach((order) => {
        let statusClass = '';
        if (order.status === 'Pendiente') statusClass = 'pending';
        else if (order.status === 'En Preparación') statusClass = 'preparing';
        else if (order.status === 'Finalizado') statusClass = 'finalizado';
        
        const div = document.createElement('div');
        div.className = `order-item ${statusClass}`;
        
        const itemsList = order.items.map(item => {
            const customText = item.customizations && item.customizations.length > 0 
                ? ` <strong style="color: #FF6B35;">[${item.customizations.join(', ')}]</strong>` 
                : '';
            const quantity = item.quantity || 1;
            const displayText = quantity > 1 
                ? `${quantity}x ${item.name}${customText}` 
                : `${item.name}${customText}`;
            return `<li>${displayText}</li>`;
        }).join('');
        
        div.innerHTML = `
            <h4>Pedido #${order.id} - ${order.username}</h4>
            <p><strong>Estado:</strong> ${order.status}</p>
            <ul>${itemsList}</ul>
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><small>${new Date(order.created_at).toLocaleString()}</small></p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                ${order.status === 'Pendiente' ? `<button onclick="updateOrderStatus(${order.id}, 'En Preparación')" style="background: #3498db;">Iniciar Preparación</button>` : ''}
                ${order.status === 'En Preparación' ? `<button onclick="updateOrderStatus(${order.id}, 'Finalizado')" style="background: #2ecc71;">Marcar Finalizado</button>` : ''}
                ${order.status === 'Finalizado' ? `<button onclick="updateOrderStatus(${order.id}, 'Cobrado')" style="background: #27ae60;">Marcar Cobrado</button>` : ''}
            </div>
        `;
        ordersDiv.appendChild(div);
    });
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await api.updateOrderStatus(orderId, newStatus);
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
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No hay pedidos pendientes de cobrar</p>';
        return;
    }
    
    finalizados.forEach((order) => {
        const div = document.createElement('div');
        div.className = 'order-item finalizado';
        
        const itemsList = order.items.map(item => {
            const customText = item.customizations && item.customizations.length > 0 
                ? ` <strong style="color: #FF6B35;">[${item.customizations.join(', ')}]</strong>` 
                : '';
            const quantity = item.quantity || 1;
            const displayText = quantity > 1 
                ? `${quantity}x ${item.name}${customText}` 
                : `${item.name}${customText}`;
            return `<li>${displayText}</li>`;
        }).join('');
        
        div.innerHTML = `
            <h4>Pedido #${order.id} - ${order.username}</h4>
            <ul>${itemsList}</ul>
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><small>${new Date(order.created_at).toLocaleString()}</small></p>
            <button onclick="showPaymentModal(${order.id}, ${order.total})" style="background: #27ae60; width: 100%; margin-top: 1rem;">💰 Cobrar Pedido</button>
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
        await api.updateOrderStatus(orderId, 'Cobrado');
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
        
        await api.createTicket(
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
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No hay pedidos cobrados</p>';
        return;
    }
    
    cobrados.forEach((order) => {
        const div = document.createElement('div');
        div.className = 'order-item cobrado';
        
        const itemsList = order.items.map(item => {
            const customText = item.customizations && item.customizations.length > 0 
                ? ` <strong style="color: #FF6B35;">[${item.customizations.join(', ')}]</strong>` 
                : '';
            const quantity = item.quantity || 1;
            const displayText = quantity > 1 
                ? `${quantity}x ${item.name}${customText}` 
                : `${item.name}${customText}`;
            return `<li>${displayText}</li>`;
        }).join('');
        
        div.innerHTML = `
            <h4>Pedido #${order.id} - ${order.username}</h4>
            <p><strong>Estado:</strong> ✓ Cobrado</p>
            <ul>${itemsList}</ul>
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><small>${new Date(order.created_at).toLocaleString()}</small></p>
        `;
        ordersDiv.appendChild(div);
    });
}

// ========== TICKETS ==========
async function loadTickets() {
    try {
        console.log('Cargando tickets...');
        printedTickets = await api.getTickets();
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
        const users = await api.getUsers();
        const employeeList = document.getElementById('employee-list');
        employeeList.innerHTML = '';
        
        users.forEach((user) => {
            const div = document.createElement('div');
            div.className = 'employee-item';
            div.innerHTML = `
                <h4>${user.username}</h4>
                <p>Rol: ${user.role}</p>
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
        await api.addUser(username, password, role);
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
    console.log('=== renderEmployeePendingOrders llamado ===');
    console.log('currentUser:', currentUser);
    console.log('pendingOrders:', pendingOrders);
    console.log('Tipo de pendingOrders:', typeof pendingOrders);
    console.log('Es array?:', Array.isArray(pendingOrders));
    
    const ordersDiv = document.getElementById('employee-pending-orders');
    console.log('Elemento encontrado:', ordersDiv);
    
    if (!ordersDiv) {
        console.error('No se encontró el elemento #employee-pending-orders');
        return;
    }
    
    ordersDiv.innerHTML = '';
    
    if (!currentUser) {
        console.error('currentUser no está definido');
        ordersDiv.innerHTML = '<p style="text-align: center; color: #E74C3C; padding: 2rem;">Error: Usuario no identificado</p>';
        return;
    }
    
    // Filtrar solo los pedidos del empleado actual que NO estén cobrados
    console.log('Filtrando pedidos del empleado:', currentUser?.username);
    console.log('Total de pedidos:', pendingOrders?.length);
    
    const myOrders = pendingOrders.filter(o => 
        o.employee === currentUser?.username && 
        o.status !== 'Cobrado'
    );
    
    console.log('Pedidos del empleado filtrados:', myOrders);
    console.log('Número de pedidos del empleado:', myOrders.length);
    
    if (myOrders.length === 0) {
        console.log('No hay pedidos del empleado, mostrando mensaje');
        ordersDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No tienes pedidos pendientes</p>';
        return;
    }
    
    console.log('Renderizando', myOrders.length, 'pedidos del empleado');
    
    myOrders.forEach((order, index) => {
        console.log(`Renderizando pedido ${index + 1}:`, order);
        let statusClass = '';
        let statusColor = '';
        let statusIcon = '';
        
        if (order.status === 'Pendiente') {
            statusClass = 'pending';
            statusColor = '#E74C3C';
            statusIcon = '🔴';
        } else if (order.status === 'En Preparación') {
            statusClass = 'preparing';
            statusColor = '#3498DB';
            statusIcon = '🔵';
        } else if (order.status === 'Finalizado') {
            statusClass = 'finalizado';
            statusColor = '#2ECC71';
            statusIcon = '🟢';
        }
        
        const div = document.createElement('div');
        div.className = `order-item ${statusClass}`;
        
        const itemsList = order.items.map(item => {
            const customText = item.customizations && item.customizations.length > 0 
                ? ` <strong style="color: #FF6B35;">[${item.customizations.join(', ')}]</strong>` 
                : '';
            const quantity = item.quantity || 1;
            const displayText = quantity > 1 
                ? `${quantity}x ${item.name}${customText}` 
                : `${item.name}${customText}`;
            return `<li>${displayText}</li>`;
        }).join('');
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">Pedido #${order.id}</h4>
                <span style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                    ${statusIcon} ${order.status}
                </span>
            </div>
            <ul>${itemsList}</ul>
            <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
            <p><small>Creado: ${new Date(order.created_at).toLocaleString()}</small></p>
            ${order.status === 'Finalizado' ? '<p style="background: #2ECC71; color: white; padding: 1rem; border-radius: 8px; text-align: center; font-weight: 700; margin-top: 1rem;">🎉 ¡LISTO PARA ENTREGAR!</p>' : ''}
        `;
        ordersDiv.appendChild(div);
    });
    
    console.log('Pedidos del empleado renderizados exitosamente');
}

// ========== EMPLEADO - HISTORIAL DE PEDIDOS ==========
let employeeHistoryFilter = 'all';

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
    console.log('=== renderEmployeeOrderHistory llamado ===');
    console.log('filter:', filter);
    console.log('currentUser:', currentUser);
    console.log('pendingOrders:', pendingOrders);
    
    const historyDiv = document.getElementById('employee-order-history');
    if (!historyDiv) {
        console.error('No se encontró el elemento #employee-order-history');
        return;
    }
    
    historyDiv.innerHTML = '';
    
    if (!currentUser) {
        console.error('currentUser no está definido');
        historyDiv.innerHTML = '<p style="text-align: center; color: #E74C3C; padding: 2rem;">Error: Usuario no identificado</p>';
        return;
    }
    
    // Filtrar pedidos del empleado
    let myOrders = pendingOrders.filter(o => o.employee === currentUser.username);
    
    console.log('Pedidos filtrados del empleado:', myOrders);
    
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
        historyDiv.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No hay pedidos en este período</p>';
        return;
    }
    
    // Ordenar por fecha (más recientes primero)
    myOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    myOrders.forEach((order) => {
        let statusClass = '';
        let statusColor = '';
        let statusIcon = '';
        
        if (order.status === 'Pendiente') {
            statusClass = 'pending';
            statusColor = '#E74C3C';
            statusIcon = '🔴';
        } else if (order.status === 'En Preparación') {
            statusClass = 'preparing';
            statusColor = '#3498DB';
            statusIcon = '🔵';
        } else if (order.status === 'Finalizado') {
            statusClass = 'finalizado';
            statusColor = '#2ECC71';
            statusIcon = '🟢';
        } else if (order.status === 'Cobrado') {
            statusClass = 'cobrado';
            statusColor = '#27AE60';
            statusIcon = '✅';
        }
        
        const div = document.createElement('div');
        div.className = `order-item ${statusClass}`;
        div.style.marginBottom = '1rem';
        
        const itemsList = order.items.map(item => {
            const customText = item.customizations && item.customizations.length > 0 
                ? ` <strong style="color: #FF6B35;">[${item.customizations.join(', ')}]</strong>` 
                : '';
            const quantity = item.quantity || 1;
            const displayText = quantity > 1 
                ? `${quantity}x ${item.name}${customText}` 
                : `${item.name}${customText}`;
            return `<li>${displayText}</li>`;
        }).join('');
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="margin: 0;">Pedido #${order.id}</h4>
                <span style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                    ${statusIcon} ${order.status}
                </span>
            </div>
            <ul style="margin: 0.5rem 0;">${itemsList}</ul>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                <p style="margin: 0;"><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
                <p style="margin: 0; color: #666; font-size: 0.9rem;">${new Date(order.created_at).toLocaleString()}</p>
            </div>
        `;
        historyDiv.appendChild(div);
    });
    
    // Mostrar estadísticas del empleado
    const totalPedidos = myOrders.length;
    const totalVentas = myOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const pedidosCobrados = myOrders.filter(o => o.status === 'Cobrado').length;
    
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = 'background: linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-top: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
    statsDiv.innerHTML = `
        <h3 style="margin-top: 0; color: white;">📊 Tus Estadísticas</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
            <div style="text-align: center;">
                <p style="font-size: 2rem; font-weight: 700; margin: 0;">${totalPedidos}</p>
                <p style="margin: 0; opacity: 0.9;">Pedidos Totales</p>
            </div>
            <div style="text-align: center;">
                <p style="font-size: 2rem; font-weight: 700; margin: 0;">$${totalVentas.toFixed(2)}</p>
                <p style="margin: 0; opacity: 0.9;">Ventas Totales</p>
            </div>
            <div style="text-align: center;">
                <p style="font-size: 2rem; font-weight: 700; margin: 0;">${pedidosCobrados}</p>
                <p style="margin: 0; opacity: 0.9;">Pedidos Cobrados</p>
            </div>
        </div>
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

// ========== REPORTES (MEJORA #3) ==========
async function generateReports() {
    try {
        const allOrders = await api.getOrders();
        
        // Estadísticas generales
        const totalOrders = allOrders.length;
        const totalSales = allOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
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
            if (salesByEmployee[order.username]) {
                salesByEmployee[order.username].count++;
                salesByEmployee[order.username].total += parseFloat(order.total);
            } else {
                salesByEmployee[order.username] = {
                    count: 1,
                    total: parseFloat(order.total)
                };
            }
        });
        
        // Renderizar reportes
        const reportsSection = document.getElementById('reportes');
        if (!reportsSection) return;
        
        reportsSection.innerHTML = `
            <h2>📊 Reportes y Estadísticas</h2>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div class="stat-card">
                    <h3>📦 Total de Pedidos</h3>
                    <p class="stat-value">${totalOrders}</p>
                </div>
                <div class="stat-card">
                    <h3>💰 Ventas Totales</h3>
                    <p class="stat-value">$${totalSales.toFixed(2)}</p>
                </div>
                <div class="stat-card">
                    <h3>📈 Ticket Promedio</h3>
                    <p class="stat-value">$${avgOrderValue.toFixed(2)}</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #FF6B35; margin-bottom: 1rem;">📊 Pedidos por Estado</h3>
                    <div style="display: grid; gap: 0.75rem;">
                        ${Object.entries(ordersByStatus).map(([status, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f8f9fa; border-radius: 6px;">
                                <span>${status}</span>
                                <strong>${count}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #FF6B35; margin-bottom: 1rem;">🏆 Productos Más Vendidos</h3>
                    <div style="display: grid; gap: 0.75rem;">
                        ${topProducts.map(([product, count], index) => `
                            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f8f9fa; border-radius: 6px;">
                                <span>${index + 1}. ${product}</span>
                                <strong>${count} unidades</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <h3 style="color: #FF6B35; margin-bottom: 1rem;">👥 Ventas por Empleado</h3>
                    <div style="display: grid; gap: 0.75rem;">
                        ${Object.entries(salesByEmployee).map(([employee, data]) => `
                            <div style="padding: 0.75rem; background: #f8f9fa; border-radius: 6px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                    <strong>${employee}</strong>
                                    <span>${data.count} pedidos</span>
                                </div>
                                <div style="color: #FF6B35; font-weight: 600;">
                                    Total: $${data.total.toFixed(2)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error generando reportes:', error);
        alert('Error al generar reportes: ' + error.message);
    }
}
