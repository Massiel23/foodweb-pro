# 🚀 Inicio Rápido - Hot Dog Heaven POS

## ⚡ Instalación en 3 Pasos

### 1️⃣ Instalar Dependencias
```bash
npm install
```

### 2️⃣ Iniciar el Servidor
```bash
npm start
```

### 3️⃣ Abrir en el Navegador
```
http://localhost:3000
```

---

## 🔑 Credenciales de Acceso

| Rol | Usuario | Contraseña | Permisos |
|-----|---------|------------|----------|
| **Admin** | `admin` | `admin` | Acceso completo |
| **Caja** | `caja` | `caja` | Cobrar pedidos, tickets |
| **Empleado** | *(crear desde admin)* | - | Solo ventas |

---

## 📱 Guía Rápida por Rol

### 👨‍💼 ADMINISTRADOR
1. Login con `admin` / `admin`
2. **Venta**: Crear pedidos
3. **Productos**: Agregar/eliminar productos
4. **Empleados**: Gestionar usuarios
5. **Pedidos**: Ver y cambiar estados
6. **Ajustes**: Configurar impuestos
7. **Facturación**: Generar facturas

### 👨‍🍳 EMPLEADO
1. Login con credenciales de empleado
2. **Venta**: Agregar productos al carrito
3. Enviar pedido
4. ✅ El pedido aparece automáticamente en Admin y Caja

### 💰 CAJA
1. Login con `caja` / `caja`
2. **Pendientes de Cobrar**: Ver pedidos listos
3. Cobrar pedido (genera ticket automático)
4. **Tickets**: Ver historial y reimprimir
5. **Cobrados**: Ver pedidos ya cobrados

---

## 🎯 Flujo Completo de un Pedido

```
EMPLEADO                    ADMIN                      CAJA
   │                          │                          │
   ├─ Crea pedido            │                          │
   │  (Pendiente)            │                          │
   │                          │                          │
   │  ────────────────────>  │                          │
   │                          │                          │
   │                          ├─ Cambia a               │
   │                          │  "En Preparación"       │
   │                          │                          │
   │                          ├─ Cambia a               │
   │                          │  "Finalizado"           │
   │                          │                          │
   │                          │  ──────────────────────> │
   │                          │                          │
   │                          │                          ├─ Cobra pedido
   │                          │                          │  (Genera ticket)
   │                          │                          │
   │                          │                          ✅ COMPLETADO
```

---

## 🔔 Notificaciones en Tiempo Real

El sistema usa **Socket.IO** para sincronización automática:

- ✅ Nuevo pedido → Notifica a Admin y Caja
- ✅ Cambio de estado → Actualiza todas las pantallas
- ✅ Nuevo producto → Se muestra en todas las sesiones
- ✅ Ticket impreso → Actualiza historial

---

## 🛠️ Comandos Útiles

```bash
# Iniciar servidor (producción)
npm start

# Iniciar con auto-reinicio (desarrollo)
npm run dev

# Ver procesos en puerto 3000
netstat -ano | findstr :3000

# Reiniciar base de datos
rm pos.db
npm start
```

---

## 📊 Productos por Defecto

El sistema viene con estos productos precargados:

- 🐕 Hot Dog Clásico - $5.00
- 🐶 Hot Dog con Queso - $6.50
- 🐕‍🦺 Hot Dog Deluxe - $8.00
- 🥤 Bebida Refresco - $2.00
- 🌱 Hot Dog Veggie - $7.00
- 🥗 Ensalada Fresca - $4.50

---

## ❓ Preguntas Frecuentes

### ¿Cómo agrego un empleado?
1. Login como Admin
2. Ir a "Agregar Empleado"
3. Ingresar usuario y contraseña
4. Click en "Agregar Empleado"

### ¿Cómo cambio el impuesto?
1. Login como Admin
2. Ir a "Ajustes"
3. Cambiar el porcentaje
4. Click en "Guardar"

### ¿Puedo reimprimir un ticket?
Sí, desde la sección "Tickets" en Caja, click en "Reimprimir"

### ¿Los datos se guardan?
Sí, todo se guarda en la base de datos SQLite (`pos.db`)

### ¿Funciona sin internet?
Sí, es un sistema local. Solo necesitas que el servidor esté corriendo.

---

## 🎨 Personalización Rápida

### Cambiar nombre del negocio
Edita `hotgogs.html` línea 21:
```html
<div class="logo">TU NOMBRE AQUÍ</div>
```

### Cambiar colores
Edita `styles.css` para personalizar la paleta.

### Agregar más productos
Desde el panel de Admin → Productos → Agregar Producto

---

## 🆘 Problemas Comunes

### "Cannot find module"
```bash
npm install
```

### "Port 3000 already in use"
Cambia el puerto en `server.js` línea 11:
```javascript
const PORT = 3001; // Cambia a otro puerto
```

### No aparecen las notificaciones
Verifica que Socket.IO esté conectado (F12 → Console)

---

## ✅ Checklist de Verificación

- [ ] Node.js instalado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Servidor corriendo (`npm start`)
- [ ] Navegador abierto en `localhost:3000`
- [ ] Login exitoso
- [ ] Productos visibles
- [ ] Pedido de prueba creado

---

**¡Listo! Tu sistema POS está funcionando** 🎉

Para más detalles, consulta `README.md`
