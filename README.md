# 🐶 Hot Dog Heaven - Sistema POS

Sistema de Punto de Venta (POS) para Hot Dog Callejones de Tamazula con integración Frontend-Backend en tiempo real.

## 🚀 Características

- ✅ **Sistema Multi-Usuario**: Admin, Empleado y Caja
- ✅ **Tiempo Real**: Sincronización automática con Socket.IO
- ✅ **Base de Datos**: SQLite para persistencia de datos
- ✅ **Gestión de Productos**: CRUD completo
- ✅ **Gestión de Pedidos**: Estados (Pendiente, En Preparación, Finalizado, Cobrado)
- ✅ **Sistema de Tickets**: Impresión y reimpresión
- ✅ **Facturación**: Generación de facturas con impuestos
- ✅ **Notificaciones**: Alertas en tiempo real

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- npm (v6 o superior)

## 🔧 Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Resetear la base de datos** (IMPORTANTE - Primera vez):
```bash
npm run reset-db
```

3. **Iniciar el servidor**:
```bash
npm start
```

O para desarrollo con auto-reinicio:
```bash
npm run dev
```

4. **Abrir en el navegador**:
```
http://localhost:3000
```

### ⚠️ Problema con el Login?

Si no puedes iniciar sesión con admin/admin:

```bash
# 1. Detener el servidor (Ctrl+C)
# 2. Resetear la base de datos
npm run reset-db
# 3. Reiniciar el servidor
npm start
```

Ver **SOLUCION_LOGIN.md** para más detalles.

## 👥 Usuarios por Defecto

### Administrador
- **Usuario**: `admin`
- **Contraseña**: `admin`
- **Permisos**: Acceso completo al sistema

### Caja
- **Usuario**: `caja`
- **Contraseña**: `caja`
- **Permisos**: Cobrar pedidos, ver tickets

### Empleados
- Se pueden crear desde el panel de administrador

## 📁 Estructura del Proyecto

```
├── hotgogs.html       # Interfaz de usuario
├── script.js          # Lógica del cliente (integrada con API)
├── api.js             # Cliente API REST
├── server.js          # Servidor Express + Socket.IO
├── styles.css         # Estilos CSS
├── package.json       # Dependencias del proyecto
├── pos.db             # Base de datos SQLite (se crea automáticamente)
└── README.md          # Este archivo
```

## 🔄 Flujo de Trabajo

### Para Empleados:
1. Iniciar sesión
2. Agregar productos al carrito
3. Enviar pedido
4. El pedido se sincroniza automáticamente con Admin y Caja

### Para Admin:
1. Ver todos los pedidos pendientes
2. Cambiar estado a "En Preparación"
3. Marcar como "Finalizado" cuando esté listo
4. Gestionar productos y empleados

### Para Caja:
1. Ver pedidos pendientes de cobrar
2. Cobrar pedido (genera ticket automáticamente)
3. Imprimir ticket
4. Ver historial de tickets

## 🌐 API Endpoints

### Usuarios
- `POST /api/login` - Iniciar sesión
- `GET /api/users` - Obtener usuarios
- `POST /api/users` - Crear usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Productos
- `GET /api/products` - Obtener productos
- `POST /api/products` - Crear producto
- `DELETE /api/products/:id` - Eliminar producto

### Pedidos
- `GET /api/orders` - Obtener pedidos
- `POST /api/orders` - Crear pedido
- `PUT /api/orders/:id` - Actualizar estado
- `DELETE /api/orders/:id` - Eliminar pedido

### Tickets
- `GET /api/tickets` - Obtener tickets
- `POST /api/tickets` - Crear ticket

## 🔌 Eventos Socket.IO

- `newOrder` - Nuevo pedido creado
- `orderUpdated` - Estado de pedido actualizado
- `productAdded` - Nuevo producto agregado
- `productDeleted` - Producto eliminado
- `userAdded` - Nuevo usuario agregado
- `ticketPrinted` - Ticket impreso

## 🎨 Personalización

### Cambiar Colores
Edita `styles.css` para personalizar la paleta de colores.

### Agregar Productos por Defecto
Edita el array `defaultProducts` en `server.js`.

### Modificar Impuesto
Desde el panel de Ajustes (solo Admin) o edita `taxRate` en `script.js`.

## 🐛 Solución de Problemas

### El servidor no inicia
```bash
# Verifica que las dependencias estén instaladas
npm install

# Verifica que el puerto 3000 esté disponible
netstat -ano | findstr :3000
```

### No se conecta Socket.IO
- Verifica que el servidor esté corriendo
- Revisa la consola del navegador (F12)
- Asegúrate de que la URL en `api.js` sea correcta

### Error de base de datos
```bash
# Elimina la base de datos y reinicia
rm pos.db
npm start
```

## 📝 Notas Importantes

- Los datos se guardan en `pos.db` (SQLite)
- Las contraseñas están en texto plano (para producción, implementar bcrypt)
- El sistema funciona en red local (localhost:3000)
- Para producción, configurar HTTPS y variables de entorno

## 🔐 Seguridad (Próximas Mejoras)

- [ ] Hash de contraseñas con bcrypt
- [ ] Tokens JWT para autenticación
- [ ] Validación de entrada más robusta
- [ ] Rate limiting
- [ ] HTTPS en producción

## 📞 Soporte

Para reportar problemas o sugerencias, contacta al desarrollador.

---

**© 2026 Hot Dog Callejones de Tamazula** 🐕🌭
