# 🧪 Guía de Pruebas - Sistema de Métodos de Pago

## ✅ Cambios Implementados

### 1. Base de Datos
- ✅ Columna `payment_method` agregada a tabla `tickets`
- ✅ Valor por defecto: 'Efectivo'

### 2. Backend (server.js)
- ✅ Endpoint `/api/tickets` acepta parámetro `payment_method`
- ✅ Guarda método de pago en base de datos

### 3. Frontend (script.js)
- ✅ Modal de pago con selector de método
- ✅ Lógica para Efectivo (con cambio)
- ✅ Lógica para Tarjeta/Transferencia (sin cambio)
- ✅ Visualización de método en ticket
- ✅ Visualización de método en lista de tickets

---

## 📋 PRUEBAS COMPLETAS - PASO A PASO

### PREPARACIÓN
1. ✅ Servidor reiniciado (base de datos recreada)
2. ⏳ Abrir navegador en: http://localhost:3000
3. ⏳ Abrir consola del navegador (F12)

---

### PRUEBA 1: Login y Preparación
**Objetivo:** Verificar acceso y crear pedidos de prueba

**Pasos:**
1. Login como **admin** (usuario: admin, contraseña: admin)
2. Ir a "Venta"
3. Agregar 2-3 productos al carrito
4. Enviar pedido
5. Ir a "Pedidos Pendientes"
6. Cambiar estado a "En Preparación"
7. Cambiar estado a "Finalizado"
8. Repetir pasos 2-7 para crear 3 pedidos finalizados
9. Cerrar sesión

**Resultado Esperado:**
- ✅ 3 pedidos en estado "Finalizado"

---

### PRUEBA 2: Pago con EFECTIVO
**Objetivo:** Verificar cálculo de cambio con efectivo

**Pasos:**
1. Login como **caja** (usuario: caja, contraseña: caja)
2. Ir a "Pedidos Pendientes de Cobrar"
3. Hacer clic en "💰 Cobrar Pedido" en el primer pedido
4. **Verificar modal:**
   - ✅ Muestra total correcto
   - ✅ Método de pago por defecto: "💵 Efectivo"
   - ✅ Campo "Monto recibido" está habilitado
5. Ingresar monto MENOR al total (ej: si total es $20, ingresar $15)
   - ✅ Debe mostrar "⚠️ Monto insuficiente"
   - ✅ Botón "Confirmar Pago" deshabilitado
6. Ingresar monto MAYOR al total (ej: si total es $20, ingresar $25)
   - ✅ Debe mostrar "Cambio: $5.00"
   - ✅ Botón "Confirmar Pago" habilitado
7. Hacer clic en "✓ Confirmar Pago"
8. **Verificar ticket mostrado:**
   - ✅ Muestra "Método de Pago: 💵 Efectivo"
   - ✅ Muestra "Recibido: $25.00"
   - ✅ Muestra "Cambio: $5.00"
9. Cerrar ticket
10. Ir a "Tickets"
11. **Verificar lista de tickets:**
    - ✅ Muestra "Método: 💵 Efectivo"
    - ✅ Muestra "Total: $20.00"
    - ✅ Muestra "Recibido: $25.00"
    - ✅ Muestra "Cambio: $5.00"

**Resultado Esperado:**
- ✅ Pago con efectivo funciona correctamente
- ✅ Cambio se calcula y muestra correctamente

---

### PRUEBA 3: Pago con TARJETA
**Objetivo:** Verificar que no hay cambio con tarjeta

**Pasos:**
1. Ir a "Pedidos Pendientes de Cobrar"
2. Hacer clic en "💰 Cobrar Pedido" en el segundo pedido
3. Cambiar método de pago a "💳 Tarjeta"
4. **Verificar comportamiento:**
   - ✅ Campo "Monto recibido" se llena automáticamente con el total
   - ✅ Campo "Monto recibido" está deshabilitado (fondo gris)
   - ✅ NO muestra sección de cambio
   - ✅ Botón "Confirmar Pago" está habilitado
5. Hacer clic en "✓ Confirmar Pago"
6. **Verificar ticket mostrado:**
   - ✅ Muestra "Método de Pago: 💳 Tarjeta"
   - ✅ Muestra "Recibido: $[total exacto]"
   - ✅ NO muestra línea de "Cambio"
7. Cerrar ticket
8. Ir a "Tickets"
9. **Verificar lista de tickets:**
    - ✅ Muestra "Método: 💳 Tarjeta"
    - ✅ NO muestra línea de "Cambio"

**Resultado Esperado:**
- ✅ Pago con tarjeta funciona correctamente
- ✅ No se calcula cambio

---

### PRUEBA 4: Pago con TRANSFERENCIA
**Objetivo:** Verificar que no hay cambio con transferencia

**Pasos:**
1. Ir a "Pedidos Pendientes de Cobrar"
2. Hacer clic en "💰 Cobrar Pedido" en el tercer pedido
3. Cambiar método de pago a "📱 Transferencia"
4. **Verificar comportamiento:**
   - ✅ Campo "Monto recibido" se llena automáticamente con el total
   - ✅ Campo "Monto recibido" está deshabilitado (fondo gris)
   - ✅ NO muestra sección de cambio
   - ✅ Botón "Confirmar Pago" está habilitado
5. Hacer clic en "✓ Confirmar Pago"
6. **Verificar ticket mostrado:**
   - ✅ Muestra "Método de Pago: 📱 Transferencia"
   - ✅ Muestra "Recibido: $[total exacto]"
   - ✅ NO muestra línea de "Cambio"
7. Cerrar ticket

**Resultado Esperado:**
- ✅ Pago con transferencia funciona correctamente
- ✅ No se calcula cambio

---

### PRUEBA 5: Reimpresión de Tickets
**Objetivo:** Verificar que la reimpresión mantiene el método de pago

**Pasos:**
1. Ir a "Tickets"
2. Para cada ticket, hacer clic en "Reimprimir"
3. **Verificar que cada ticket reimpreso muestra:**
   - ✅ Método de pago correcto (Efectivo/Tarjeta/Transferencia)
   - ✅ Icono correcto (💵/💳/📱)
   - ✅ Cambio solo si es Efectivo y hay cambio

**Resultado Esperado:**
- ✅ Reimpresión funciona correctamente
- ✅ Mantiene toda la información del pago original

---

### PRUEBA 6: Notificaciones
**Objetivo:** Verificar mensajes de notificación

**Pasos:**
1. Cobrar un pedido con cada método de pago
2. **Verificar notificaciones:**
   - Efectivo con cambio: "Pedido #X cobrado con Efectivo. Cambio: $Y.YY"
   - Tarjeta: "Pedido #X cobrado con Tarjeta."
   - Transferencia: "Pedido #X cobrado con Transferencia."

**Resultado Esperado:**
- ✅ Notificaciones muestran método de pago
- ✅ Solo muestra cambio cuando aplica

---

### PRUEBA 7: Consola del Navegador
**Objetivo:** Verificar que no hay errores en consola

**Pasos:**
1. Abrir consola del navegador (F12)
2. Realizar un pago completo
3. **Verificar logs:**
   - ✅ No hay errores en rojo
   - ✅ Logs muestran "Ticket creado" con payment_method
   - ✅ Logs muestran "Ticket mostrado"

**Resultado Esperado:**
- ✅ Sin errores en consola
- ✅ Logs confirman funcionamiento correcto

---

### PRUEBA 8: Validación de Base de Datos (Opcional)
**Objetivo:** Verificar que los datos se guardan correctamente

**Pasos:**
1. Instalar SQLite Browser o usar comando:
   ```bash
   sqlite3 pos.db "SELECT id, order_id, payment_method, amount_received, change_given FROM tickets;"
   ```
2. **Verificar:**
   - ✅ Columna `payment_method` existe
   - ✅ Valores correctos: 'Efectivo', 'Tarjeta', 'Transferencia'
   - ✅ `amount_received` y `change_given` correctos

---

## 📊 RESUMEN DE RESULTADOS

### Funcionalidades Probadas:
- [ ] Modal de pago con selector de método
- [ ] Pago con Efectivo (con cálculo de cambio)
- [ ] Pago con Tarjeta (sin cambio)
- [ ] Pago con Transferencia (sin cambio)
- [ ] Validación de monto insuficiente
- [ ] Visualización en ticket
- [ ] Visualización en lista de tickets
- [ ] Reimpresión de tickets
- [ ] Notificaciones
- [ ] Sin errores en consola

### Problemas Encontrados:
(Anotar aquí cualquier problema)

---

## 🐛 PROBLEMAS CONOCIDOS Y SOLUCIONES

### Problema: "Pedido no encontrado" al reimprimir
**Solución:** El pedido debe estar en la lista de `pendingOrders`. Si fue eliminado, no se puede reimprimir.

### Problema: Ticket no se muestra después de pagar
**Solución:** Verificar consola del navegador para errores. El ticket debe mostrarse antes de actualizar las listas.

### Problema: Base de datos no tiene columna `payment_method`
**Solución:** Eliminar `pos.db` y reiniciar el servidor para recrear la base de datos.

---

## ✅ CRITERIOS DE ACEPTACIÓN

Para considerar la funcionalidad como **COMPLETADA**, todas estas condiciones deben cumplirse:

1. ✅ Modal de pago muestra selector de método
2. ✅ Efectivo permite ingresar monto y calcula cambio
3. ✅ Tarjeta/Transferencia fijan monto automáticamente
4. ✅ Validación de monto insuficiente funciona
5. ✅ Ticket muestra método de pago con icono correcto
6. ✅ Lista de tickets muestra método de pago
7. ✅ Reimpresión mantiene método de pago
8. ✅ Sin errores en consola del navegador
9. ✅ Base de datos guarda método de pago correctamente

---

**Fecha de Pruebas:** ______06/02/2026_______
**Probado por:** _massiel lopez____________
**Estado Final:** [ *] APROBADO  [ ] RECHAZADO  [ ] PENDIENTE
