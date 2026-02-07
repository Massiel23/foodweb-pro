# 🧪 Guía de Pruebas - Hot Dog Heaven POS

## 📋 Checklist de Pruebas

Usa esta guía para verificar que todas las funcionalidades están funcionando correctamente después de la integración.

---

## 🚀 Preparación

### 1. Instalación
```bash
# Instalar dependencias
npm install

# Verificar que se instalaron correctamente
npm list
```

**✅ Verificar**: Debe mostrar express, sqlite3, cors, body-parser, socket.io

### 2. Iniciar Servidor
```bash
npm start
```

**✅ Verificar**: 
- Debe mostrar "Conectado a SQLite."
- Debe mostrar "Servidor corriendo en http://localhost:3000"

### 3. Abrir Navegador
```
http://localhost:3000
```

**✅ Verificar**: Debe mostrar la pantalla de login

---

## 🔐 Pruebas de Autenticación

### Test 1: Login Incorrecto
1. Usuario: `test`
2. Contraseña: `test`
3. Click en "Iniciar Sesión"

**✅ Resultado Esperado**: Mensaje de error "Usuario o contraseña incorrectos"

### Test 2: Login Admin
1. Usuario: `admin`
2. Contraseña: `admin`
3. Click en "Iniciar Sesión"

**✅ Resultado Esperado**: 
- Pantalla de login desaparece
- Aparece navegación con 6 botones
- Muestra sección "Venta"
- Notificación "Bienvenido, admin!"

### Test 3: Logout
1. Click en "Cerrar Sesión"

**✅ Resultado Esperado**: Vuelve a pantalla de login

---

## 🛒 Pruebas de Venta (Empleado/Admin)

### Test 4: Ver Productos
1. Login como admin
2. Verificar sección "Venta"

**✅ Resultado Esperado**: 
- Debe mostrar 6 productos por defecto
- Cada producto con emoji, nombre, precio y botón "Agregar"

### Test 5: Agregar al Carrito
1. Click en "Agregar" en "Hot Dog Clásico"
2. Click en "Agregar" en "Bebida Refresco"

**✅ Resultado Esperado**:
- Aparecen en el carrito
- Total: $7.00
- Notificaciones de productos agregados

### Test 6: Quitar del Carrito
1. Click en "Quitar" en uno de los productos

**✅ Resultado Esperado**:
- Producto removido del carrito
- Total actualizado

### Test 7: Enviar Pedido
1. Agregar productos al carrito
2. Click en "Enviar Pedido"

**✅ Resultado Esperado**:
- Notificación "Pedido enviado exitosamente"
- Carrito vacío
- Total: $0.00

---

## 📦 Pruebas de Productos (Admin)

### Test 8: Ver Productos Admin
1. Click en "Productos"

**✅ Resultado Esperado**:
- Lista de productos con botón "Eliminar"
- Formulario para agregar producto

### Test 9: Agregar Producto
1. Nombre: `Hot Dog Especial`
2. Precio: `9.50`
3. Click en "Agregar"

**✅ Resultado Esperado**:
- Notificación "Producto agregado exitosamente"
- Producto aparece en la lista
- Campos del formulario vacíos

### Test 10: Eliminar Producto
1. Click en "Eliminar" en un producto
2. Confirmar eliminación

**✅ Resultado Esperado**:
- Notificación "Producto eliminado"
- Producto desaparece de la lista

---

## 👥 Pruebas de Empleados (Admin)

### Test 11: Ver Empleados
1. Click en "Agregar Empleado"

**✅ Resultado Esperado**:
- Formulario para agregar empleado
- Lista de empleados (inicialmente vacía)

### Test 12: Agregar Empleado
1. Usuario: `empleado1`
2. Contraseña: `1234`
3. Click en "Agregar Empleado"

**✅ Resultado Esperado**:
- Mensaje "Empleado agregado"
- Empleado aparece en la lista
- Notificación de éxito

### Test 13: Login como Empleado
1. Logout
2. Login con `empleado1` / `1234`

**✅ Resultado Esperado**:
- Solo muestra botón "Venta"
- No tiene acceso a otras secciones

### Test 14: Eliminar Empleado
1. Login como admin
2. Ir a "Agregar Empleado"
3. Click en "Eliminar" en empleado1
4. Confirmar

**✅ Resultado Esperado**:
- Notificación "Empleado eliminado"
- Empleado desaparece de la lista

---

## 📋 Pruebas de Pedidos (Admin)

### Test 15: Ver Pedidos Pendientes
1. Crear un pedido (como empleado o admin)
2. Click en "Pedidos Pendientes"

**✅ Resultado Esperado**:
- Pedido aparece con estado "Pendiente"
- Fondo rojo
- Botones "Empezar a Preparar" y "Finalizar Pedido"

### Test 16: Cambiar Estado a "En Preparación"
1. Click en "Empezar a Preparar"

**✅ Resultado Esperado**:
- Estado cambia a "En Preparación"
- Fondo azul
- Notificación de actualización

### Test 17: Cambiar Estado a "Finalizado"
1. Click en "Finalizar Pedido"

**✅ Resultado Esperado**:
- Estado cambia a "Finalizado"
- Fondo verde
- Notificación de actualización

---

## 💰 Pruebas de Caja

### Test 18: Login como Caja
1. Logout
2. Login con `caja` / `caja`

**✅ Resultado Esperado**:
- Muestra 3 botones: Pendientes de Cobrar, Cobrados, Tickets
- Sección activa: "Pedidos Pendientes de Cobrar"

### Test 19: Ver Pedidos Pendientes de Cobrar
1. Verificar sección "Pedidos Pendientes de Cobrar"

**✅ Resultado Esperado**:
- Muestra pedidos que no están cobrados
- Botón "Cobrar" en cada pedido

### Test 20: Cobrar Pedido
1. Click en "Cobrar" en un pedido

**✅ Resultado Esperado**:
- Aparece ticket de compra
- Muestra detalles del pedido
- Botones "Imprimir" y "Cancelar"
- Notificación "Pedido cobrado"

### Test 21: Imprimir Ticket
1. Click en "Imprimir"

**✅ Resultado Esperado**:
- Abre diálogo de impresión del navegador
- Ticket desaparece después de cerrar diálogo

### Test 22: Ver Pedidos Cobrados
1. Click en "Pedidos Cobrados"

**✅ Resultado Esperado**:
- Muestra pedidos con estado "Cobrado"
- Fondo verde
- Sin botones de acción

### Test 23: Ver Tickets
1. Click en "Tickets"

**✅ Resultado Esperado**:
- Lista de todos los tickets generados
- Botón "Reimprimir" en cada ticket

### Test 24: Reimprimir Ticket
1. Click en "Reimprimir" en un ticket

**✅ Resultado Esperado**:
- Muestra ticket nuevamente
- Botones "Imprimir" y "Cancelar"

---

## ⚙️ Pruebas de Ajustes (Admin)

### Test 25: Cambiar Impuesto
1. Login como admin
2. Click en "Ajustes"
3. Cambiar impuesto a 15
4. Click en "Guardar"

**✅ Resultado Esperado**:
- Mensaje "Ajustes guardados"
- Notificación de éxito

---

## 📄 Pruebas de Facturación (Admin)

### Test 26: Generar Factura
1. Asegurarse de tener al menos un pedido cobrado
2. Click en "Facturación"
3. Click en "Generar Factura"

**✅ Resultado Esperado**:
- Muestra factura con detalles
- Incluye subtotal, impuesto y total
- Botón "Imprimir"

### Test 27: Imprimir Factura
1. Click en "Imprimir"

**✅ Resultado Esperado**:
- Abre diálogo de impresión

---

## 🔔 Pruebas de Tiempo Real (Socket.IO)

### Test 28: Sincronización de Pedidos
**Preparación**: Abrir 2 ventanas del navegador

**Ventana 1**: Login como empleado
**Ventana 2**: Login como admin

1. En Ventana 1: Crear un pedido
2. Observar Ventana 2

**✅ Resultado Esperado**:
- Ventana 2 muestra notificación "Nuevo pedido recibido"
- Pedido aparece automáticamente en "Pedidos Pendientes"

### Test 29: Sincronización de Estados
**Ventana 1**: Admin en "Pedidos Pendientes"
**Ventana 2**: Caja en "Pendientes de Cobrar"

1. En Ventana 1: Cambiar estado a "Finalizado"
2. Observar Ventana 2

**✅ Resultado Esperado**:
- Ventana 2 muestra notificación de actualización
- Pedido se actualiza automáticamente

### Test 30: Sincronización de Productos
**Ventana 1**: Admin en "Productos"
**Ventana 2**: Empleado en "Venta"

1. En Ventana 1: Agregar nuevo producto
2. Observar Ventana 2

**✅ Resultado Esperado**:
- Producto aparece automáticamente en Ventana 2
- Sin necesidad de recargar

---

## 🗄️ Pruebas de Base de Datos

### Test 31: Persistencia de Datos
1. Crear varios pedidos
2. Agregar productos
3. Agregar empleados
4. Cerrar servidor (Ctrl+C)
5. Reiniciar servidor (`npm start`)
6. Abrir navegador y login

**✅ Resultado Esperado**:
- Todos los datos siguen ahí
- Productos guardados
- Pedidos guardados
- Empleados guardados

### Test 32: Verificar Base de Datos
```bash
# Instalar sqlite3 CLI si no lo tienes
# Windows: descargar de sqlite.org
# Mac: brew install sqlite
# Linux: sudo apt-get install sqlite3

# Abrir base de datos
sqlite3 pos.db

# Ver tablas
.tables

# Ver usuarios
SELECT * FROM users;

# Ver productos
SELECT * FROM products;

# Ver pedidos
SELECT * FROM orders;

# Ver tickets
SELECT * FROM tickets;

# Salir
.quit
```

**✅ Resultado Esperado**: Datos correctamente almacenados

---

## 🌐 Pruebas de Consola del Navegador

### Test 33: Verificar Socket.IO
1. Abrir DevTools (F12)
2. Ir a Console
3. Login

**✅ Resultado Esperado**:
- Mensaje "Conectado al servidor Socket.IO"
- Sin errores en consola

### Test 34: Verificar Peticiones API
1. Abrir DevTools (F12)
2. Ir a Network
3. Realizar acciones (crear pedido, agregar producto, etc.)

**✅ Resultado Esperado**:
- Peticiones a `/api/*` con status 200
- Respuestas JSON correctas

---

## ⚠️ Pruebas de Errores

### Test 35: Campos Vacíos
1. Intentar agregar producto sin nombre
2. Intentar agregar empleado sin datos
3. Intentar enviar pedido con carrito vacío

**✅ Resultado Esperado**: Mensajes de error apropiados

### Test 36: Usuario Duplicado
1. Intentar agregar empleado con username existente

**✅ Resultado Esperado**: Error "El usuario ya existe"

### Test 37: Acceso Denegado
1. Login como empleado
2. Intentar acceder a URL directa de admin

**✅ Resultado Esperado**: Mensaje "Acceso denegado"

---

## 📊 Resumen de Pruebas

### Checklist Final

- [ ] Autenticación (Tests 1-3)
- [ ] Venta (Tests 4-7)
- [ ] Productos (Tests 8-10)
- [ ] Empleados (Tests 11-14)
- [ ] Pedidos (Tests 15-17)
- [ ] Caja (Tests 18-24)
- [ ] Ajustes (Test 25)
- [ ] Facturación (Tests 26-27)
- [ ] Tiempo Real (Tests 28-30)
- [ ] Base de Datos (Tests 31-32)
- [ ] Consola (Tests 33-34)
- [ ] Errores (Tests 35-37)

---

## 🐛 Reporte de Bugs

Si encuentras algún problema durante las pruebas:

1. **Anota**:
   - Número de test
   - Pasos para reproducir
   - Resultado esperado
   - Resultado obtenido
   - Mensaje de error (si hay)

2. **Verifica**:
   - Consola del navegador (F12)
   - Terminal del servidor
   - Base de datos

3. **Documenta** en TODO.md sección "BUGS CONOCIDOS"

---

## ✅ Criterios de Éxito

El sistema está funcionando correctamente si:

- ✅ Todos los tests pasan
- ✅ No hay errores en consola
- ✅ Socket.IO conecta correctamente
- ✅ Datos persisten en base de datos
- ✅ Sincronización en tiempo real funciona
- ✅ Todas las notificaciones aparecen
- ✅ Roles y permisos funcionan correctamente

---

**¡Buena suerte con las pruebas!** 🧪✨
