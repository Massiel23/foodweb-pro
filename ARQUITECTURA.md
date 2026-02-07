# 🏗️ Arquitectura del Sistema - Hot Dog Heaven POS

## 📐 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR (Cliente)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ hotgogs.html │  │  styles.css  │  │  script.js   │         │
│  │   (Vista)    │  │   (Estilos)  │  │   (Lógica)   │         │
│  └──────────────┘  └──────────────┘  └──────┬───────┘         │
│                                              │                   │
│                          ┌───────────────────┴────────┐         │
│                          │       api.js               │         │
│                          │  (Cliente API REST)        │         │
│                          └───────────┬────────────────┘         │
│                                      │                           │
└──────────────────────────────────────┼───────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    │         HTTP/REST & WebSocket       │
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       │
┌──────────────────────────────────────┼───────────────────────────┐
│                         SERVIDOR (Backend)                        │
├──────────────────────────────────────┼───────────────────────────┤
│                                      │                            │
│  ┌───────────────────────────────────▼──────────────────────┐   │
│  │                      server.js                            │   │
│  │                   (Express + Socket.IO)                   │   │
│  └───────────────────────────────────┬──────────────────────┘   │
│                                      │                            │
│         ┌────────────────────────────┼────────────────┐          │
│         │                            │                │          │
│    ┌────▼─────┐              ┌──────▼──────┐  ┌─────▼──────┐   │
│    │   API    │              │  Socket.IO  │  │   Static   │   │
│    │ Endpoints│              │   Events    │  │   Files    │   │
│    └────┬─────┘              └──────┬──────┘  └────────────┘   │
│         │                           │                            │
│         └───────────┬───────────────┘                            │
│                     │                                             │
│              ┌──────▼──────┐                                     │
│              │   SQLite    │                                     │
│              │  Database   │                                     │
│              │  (pos.db)   │                                     │
│              └─────────────┘                                     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

### 1. Autenticación
```
Usuario → HTML Form → script.js → api.login() → POST /api/login
                                                      ↓
                                                  server.js
                                                      ↓
                                              Consulta BD (users)
                                                      ↓
                                              Retorna usuario
                                                      ↓
                                              script.js guarda sesión
                                                      ↓
                                              Muestra interfaz
```

### 2. Crear Pedido
```
Empleado → Agregar productos → Carrito → Enviar Pedido
                                              ↓
                                        api.createOrder()
                                              ↓
                                      POST /api/orders
                                              ↓
                                         server.js
                                              ↓
                                    Guarda en BD (orders)
                                              ↓
                                    io.emit('newOrder')
                                              ↓
                        ┌───────────────────┴───────────────────┐
                        ↓                                       ↓
                   Admin recibe                           Caja recibe
                   notificación                          notificación
                        ↓                                       ↓
                Actualiza vista                         Actualiza vista
```

### 3. Sincronización en Tiempo Real
```
Acción en Cliente A → API Request → Server → BD → Socket.IO Event
                                                          ↓
                                    ┌─────────────────────┴──────────────┐
                                    ↓                                    ↓
                              Cliente A                            Cliente B
                           (Actualiza UI)                      (Actualiza UI)
```

---

## 📦 Componentes del Sistema

### Frontend (Cliente)

#### 1. **hotgogs.html**
- **Responsabilidad**: Estructura de la interfaz
- **Contiene**:
  - Formulario de login
  - Navegación por roles
  - Secciones (Venta, Productos, Pedidos, etc.)
  - Modals (Tickets, Facturas)

#### 2. **styles.css**
- **Responsabilidad**: Presentación visual
- **Incluye**:
  - Estilos generales
  - Animaciones
  - Responsive design
  - Estilos de impresión

#### 3. **script.js**
- **Responsabilidad**: Lógica del cliente
- **Funciones principales**:
  - Gestión de autenticación
  - Manejo de eventos UI
  - Renderizado dinámico
  - Integración con API
  - Manejo de Socket.IO
  - Notificaciones

#### 4. **api.js**
- **Responsabilidad**: Cliente API REST
- **Métodos**:
  - `login()`, `getUsers()`, `addUser()`, `deleteUser()`
  - `getProducts()`, `addProduct()`, `deleteProduct()`
  - `getOrders()`, `createOrder()`, `updateOrderStatus()`
  - `getTickets()`, `createTicket()`

### Backend (Servidor)

#### 5. **server.js**
- **Responsabilidad**: Servidor principal
- **Componentes**:
  - Express app
  - Socket.IO server
  - SQLite database
  - API endpoints
  - Middleware

---

## 🗄️ Modelo de Datos

### Entidades y Relaciones

```
┌─────────────┐
│    users    │
├─────────────┤
│ id          │ PK
│ username    │ UNIQUE
│ password    │
│ role        │
└─────────────┘

┌─────────────┐
│  products   │
├─────────────┤
│ id          │ PK
│ name        │
│ price       │
│ img         │
└─────────────┘

┌─────────────┐         ┌─────────────┐
│   orders    │         │   tickets   │
├─────────────┤         ├─────────────┤
│ id          │ PK ─────│ order_id    │ FK
│ employee    │         │ id          │ PK
│ items       │ JSON    │ employee    │
│ total       │         │ items       │ JSON
│ status      │         │ total       │
│ created_at  │         │ date        │
└─────────────┘         └─────────────┘
```

### Estados de Pedidos

```
Pendiente → En Preparación → Finalizado → Cobrado
   (🔴)         (🔵)            (🟢)        (🟢)
```

---

## 🔌 API REST Endpoints

### Estructura de Endpoints

```
/api
├── /login              POST    Autenticación
├── /users              GET     Listar usuarios
│   ├── /               POST    Crear usuario
│   └── /:id            DELETE  Eliminar usuario
├── /products           GET     Listar productos
│   ├── /               POST    Crear producto
│   └── /:id            DELETE  Eliminar producto
├── /orders             GET     Listar pedidos
│   ├── /               POST    Crear pedido
│   ├── /:id            PUT     Actualizar estado
│   └── /:id            DELETE  Eliminar pedido
└── /tickets            GET     Listar tickets
    └── /               POST    Crear ticket
```

### Formato de Respuestas

#### Éxito
```json
{
  "id": 1,
  "name": "Hot Dog Clásico",
  "price": 5.00
}
```

#### Error
```json
{
  "error": "Mensaje de error descriptivo"
}
```

---

## 🔔 Eventos Socket.IO

### Eventos del Servidor

```javascript
// Emitidos por el servidor
io.emit('newOrder', order)           // Nuevo pedido creado
io.emit('orderUpdated', data)        // Pedido actualizado
io.emit('productAdded', product)     // Producto agregado
io.emit('productDeleted', data)      // Producto eliminado
io.emit('userAdded', user)           // Usuario agregado
io.emit('userDeleted', data)         // Usuario eliminado
io.emit('ticketPrinted', ticket)     // Ticket impreso
```

### Eventos del Cliente

```javascript
// Escuchados por el cliente
socket.on('connect', callback)       // Conexión establecida
socket.on('disconnect', callback)    // Desconexión
socket.on('newOrder', callback)      // Nuevo pedido
socket.on('orderUpdated', callback)  // Pedido actualizado
// ... etc
```

---

## 🔐 Seguridad

### Actual (Básica)

```
┌──────────────┐
│   Cliente    │
└──────┬───────┘
       │ username/password (texto plano)
       ↓
┌──────────────┐
│   Servidor   │
└──────┬───────┘
       │ Consulta directa
       ↓
┌──────────────┐
│ Base de Datos│
└──────────────┘
```

### Recomendada (Futura)

```
┌──────────────┐
│   Cliente    │
└──────┬───────┘
       │ username/password
       ↓
┌──────────────┐
│   Servidor   │ ← bcrypt hash
└──────┬───────┘
       │ Hash comparado
       ↓
┌──────────────┐
│ Base de Datos│ ← Contraseñas hasheadas
└──────┬───────┘
       │ JWT Token
       ↓
┌──────────────┐
│   Cliente    │ ← Token en headers
└──────────────┘
```

---

## 📊 Patrones de Diseño Utilizados

### 1. **MVC (Modelo-Vista-Controlador)**
- **Modelo**: Base de datos SQLite
- **Vista**: HTML + CSS
- **Controlador**: script.js + server.js

### 2. **API REST**
- Endpoints RESTful
- Métodos HTTP estándar (GET, POST, PUT, DELETE)
- Respuestas JSON

### 3. **Observer Pattern (Socket.IO)**
- Clientes suscritos a eventos
- Servidor emite eventos
- Actualización automática

### 4. **Singleton (API Client)**
- Una sola instancia de `api`
- Compartida en toda la aplicación

---

## 🚀 Escalabilidad

### Actual (Monolítico)
```
Cliente → Servidor único → BD única
```

### Futuro (Microservicios)
```
                    ┌─ Servicio Auth
Cliente → Gateway ──┼─ Servicio Pedidos
                    ├─ Servicio Productos
                    └─ Servicio Tickets
                           ↓
                    Base de datos distribuida
```

---

## 📈 Rendimiento

### Optimizaciones Actuales
- ✅ Conexión persistente Socket.IO
- ✅ Consultas SQL indexadas
- ✅ Caché en cliente (localStorage para config)

### Optimizaciones Futuras
- [ ] Paginación de resultados
- [ ] Lazy loading
- [ ] Service Workers
- [ ] CDN para assets
- [ ] Compresión gzip
- [ ] Database pooling

---

## 🔧 Tecnologías Utilizadas

### Frontend
- **HTML5**: Estructura
- **CSS3**: Estilos y animaciones
- **JavaScript ES6+**: Lógica
- **Socket.IO Client**: WebSockets

### Backend
- **Node.js**: Runtime
- **Express**: Framework web
- **Socket.IO**: WebSockets
- **SQLite3**: Base de datos
- **CORS**: Cross-Origin Resource Sharing
- **Body-Parser**: Parsing de JSON

---

## 📝 Convenciones de Código

### Nomenclatura
- **Variables**: camelCase (`currentUser`, `pendingOrders`)
- **Funciones**: camelCase (`loadProducts()`, `renderOrders()`)
- **Constantes**: UPPER_CASE (`PORT`, `API_URL`)
- **Clases**: PascalCase (`API`)

### Estructura de Archivos
```
proyecto/
├── hotgogs.html      # Vista principal
├── script.js         # Lógica cliente
├── api.js            # Cliente API
├── styles.css        # Estilos
├── server.js         # Servidor
├── package.json      # Dependencias
├── pos.db            # Base de datos (generada)
└── docs/             # Documentación
    ├── README.md
    ├── INICIO_RAPIDO.md
    ├── TODO.md
    ├── PRUEBAS.md
    └── ARQUITECTURA.md
```

---

## 🎯 Principios de Diseño

1. **Separación de Responsabilidades**
   - Frontend maneja UI
   - Backend maneja lógica de negocio
   - Base de datos maneja persistencia

2. **DRY (Don't Repeat Yourself)**
   - Cliente API centralizado
   - Funciones reutilizables

3. **KISS (Keep It Simple, Stupid)**
   - Código claro y legible
   - Evitar sobre-ingeniería

4. **Fail Fast**
   - Validaciones tempranas
   - Manejo de errores explícito

---

## 🔄 Ciclo de Vida de una Petición

```
1. Usuario hace click
   ↓
2. Event handler en script.js
   ↓
3. Llamada a api.js
   ↓
4. Fetch HTTP a servidor
   ↓
5. Express router en server.js
   ↓
6. Validación de datos
   ↓
7. Operación en base de datos
   ↓
8. Emisión de evento Socket.IO
   ↓
9. Respuesta HTTP al cliente
   ↓
10. Actualización de UI
    ↓
11. Notificación al usuario
```

---

**Versión**: 1.0.0  
**Última actualización**: 2024
