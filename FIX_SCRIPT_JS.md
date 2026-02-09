# 🔧 CORRECCIÓN DE script.js - Instrucciones Manuales

## 🐛 PROBLEMA

El archivo `script.js` tiene marcadores de conflicto de merge en las líneas 204 y 220 que causan errores de sintaxis.

## ✅ SOLUCIÓN RÁPIDA

### Opción 1: Usar el Backup Original

```bash
# 1. Detener el servidor (Ctrl+C en la terminal)
# 2. Restaurar el archivo original
cp script-backup.js script.js
```

Luego hacer los cambios manualmente:

### Cambio 1: Función addToCart (línea ~318)

**BUSCAR**:
```javascript
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
```

**REEMPLAZAR CON**:
```javascript
function addToCart(id, name, price) {
    // Siempre mostrar ventana de personalización para todos los roles
    showCustomizationModal(id, name, price);
}
```

### Cambio 2: Función showSection (línea ~201)

**BUSCAR**:
```javascript
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
```

**REEMPLAZAR CON**:
```javascript
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
```

### Cambio 3: Función login (línea ~145)

**BUSCAR**:
```javascript
const user = await api.login(username, password);
currentUser = user;
```

**REEMPLAZAR CON**:
```javascript
const response = await api.login(username, password);
currentUser = response.user;
```

Y más abajo en la misma función:

**BUSCAR**:
```javascript
if (user.role === 'admin') {
    document.getElementById('nav-admin').style.display = 'block';
} else if (user.role === 'caja') {
    document.getElementById('nav-caja').style.display = 'block';
} else {
    document.getElementById('nav-empleado').style.display = 'block';
}
```

**REEMPLAZAR CON**:
```javascript
if (response.user.role === 'admin') {
    document.getElementById('nav-admin').style.display = 'block';
} else if (response.user.role === 'caja') {
    document.getElementById('nav-caja').style.display = 'block';
} else {
    document.getElementById('nav-empleado').style.display = 'block';
}
```

Y:

**BUSCAR**:
```javascript
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
```

**REEMPLAZAR CON**:
```javascript
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
```

### Cambio 4: Función logout (línea ~195)

**BUSCAR**:
```javascript
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    document.getElementById('app').style.display = 'none';
```

**REEMPLAZAR CON**:
```javascript
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    api.clearToken();
    
    document.getElementById('app').style.display = 'none';
```

---

## ✅ VERIFICACIÓN

Después de hacer los cambios:

1. Guardar el archivo
2. El servidor se reiniciará automáticamente (nodemon)
3. Refrescar el navegador (F5)
4. Probar:
   - Login como admin
   - Acceder a todas las secciones (debe funcionar)
   - Agregar producto al carrito
   - Debe aparecer ventana de personalización

---

## 🚀 RESUMEN DE CAMBIOS

### 1. Ventana de Personalización
**Antes**: Solo para empleados y admin
**Después**: Para TODOS los roles (admin, caja, empleado)

### 2. Acceso del Administrador
**Antes**: Tenía restricciones
**Después**: Acceso COMPLETO a todas las secciones

### 3. Autenticación con JWT
**Antes**: `const user = await api.login(...)`
**Después**: `const response = await api.login(...)` y usar `response.user`

### 4. Logout
**Antes**: Solo limpiaba localStorage
**Después**: También limpia el token JWT con `api.clearToken()`

---

## 📝 NOTAS

- Los cambios son compatibles con el servidor seguro (server-secure.js)
- Mantienen toda la funcionalidad existente
- Mejoran la experiencia de usuario
- Son compatibles con JWT y bcrypt

---

## ⚠️ SI HAY ERRORES

Si después de los cambios hay errores:

1. **Error de sintaxis**: Verificar que no haya marcadores de conflicto (`=======`, `<<<<<<<`, `>>>>>>>`)
2. **Error de token**: Verificar que `api.js` tenga el método `clearToken()`
3. **Error de login**: Verificar que se use `response.user` en lugar de `user`

---

## 🎯 RESULTADO ESPERADO

Después de aplicar los cambios:

✅ Admin puede acceder a TODAS las secciones
✅ Ventana de personalización aparece para TODOS
✅ Login funciona con JWT
✅ Logout limpia el token correctamente
✅ Sin errores de sintaxis
✅ Sistema funcionando al 100%
