# 🧪 GUÍA DE PRUEBAS - MEJORA #1: Método de Pago y Cambio

## 📋 PREPARACIÓN

1. **Servidor corriendo:** ✅ Ya está ejecutándose en `http://localhost:3000`
2. **Abrir navegador:** Ve a `http://localhost:3000/hotgogs.html`
3. **Usuarios de prueba:**
   - Admin: `admin` / `admin`
   - Empleado: `empleado` / `empleado`
   - Caja: `caja` / `caja`

---

## 🔄 FLUJO COMPLETO DE PRUEBA

### PASO 1: Crear un Pedido (Como Empleado)

1. Login como **empleado** / **empleado**
2. Ir a sección "Venta"
3. Agregar un producto (ej: Hot Dog - $45.00)
4. En el modal de personalización:
   - Seleccionar algunas opciones (ej: sin cebolla, sin chile)
   - Click en "Agregar al Carrito"
5. Verificar que aparece en el carrito con personalizaciones
6. Click en "Enviar Pedido"
7. Verificar notificación de éxito
8. Logout

### PASO 2: Preparar el Pedido (Como Admin)

1. Login como **admin** / **admin**
2. Ir a sección "Pedidos Pendientes"
3. Verificar que aparece el pedido del empleado
4. Click en "Empezar a Preparar"
5. Verificar que cambia a estado "En Preparación" (fondo azul)
6. Click en "Finalizar Pedido"
7. Verificar que cambia a estado "Finalizado" (fondo verde)
8. Logout

### PASO 3: Cobrar con EFECTIVO (Como Caja)

1. Login como **caja** / **caja**
2. Ir a sección "Pedidos Pendientes de Cobrar"
3. Verificar que aparece el pedido finalizado
4. Click en "Cobrar"

**✅ VERIFICAR MODAL DE PAGO:**
- [ ] Modal se abre correctamente
- [ ] Muestra título "💰 Cobrar Pedido #X"
- [ ] Muestra total del pedido
- [ ] Muestra 3 botones: Efectivo, Tarjeta, Transferencia
- [ ] Botón "Confirmar Cobro" está deshabilitado (gris)

5. Click en botón "💵 Efectivo"

**✅ VERIFICAR SELECCIÓN DE EFECTIVO:**
- [ ] Botón de Efectivo cambia a verde
- [ ] Aparece input "Monto Recibido"
- [ ] Botón "Confirmar Cobro" sigue deshabilitado

6. Ingresar monto MENOR al total (ej: si total es $45, ingresar $40)

**✅ VERIFICAR VALIDACIÓN:**
- [ ] NO aparece el cambio
- [ ] Botón "Confirmar Cobro" sigue deshabilitado

7. Ingresar monto IGUAL al total (ej: $45.00)

**✅ VERIFICAR MONTO EXACTO:**
- [ ] Aparece "Cambio: $0.00" en verde
- [ ] Botón "Confirmar Cobro" se habilita

8. Ingresar monto MAYOR al total (ej: $50.00)

**✅ VERIFICAR CÁLCULO DE CAMBIO:**
- [ ] Aparece "Cambio: $5.00" en verde
- [ ] Cambio se calcula correctamente
- [ ] Botón "Confirmar Cobro" está habilitado

9. Click en "✓ Confirmar Cobro"

**✅ VERIFICAR TICKET:**
- [ ] Modal de pago se cierra
- [ ] Aparece ticket estilo OXXO
- [ ] Ticket muestra:
  - Encabezado "HOT DOGS CALLEJONES DE TAMAZULA"
  - Número de ticket
  - Número de pedido
  - Cajero
  - Fecha y hora
  - Lista de productos con personalizaciones
  - Subtotal y Total
  - **Método de Pago: EFECTIVO**
  - **Recibido: $50.00**
  - **Cambio: $5.00**
  - Mensaje de agradecimiento
  - Código de barras simulado
  - Botones "Imprimir" y "Cancelar"

10. Click en "Cancelar" para cerrar el ticket

**✅ VERIFICAR ESTADO:**
- [ ] Pedido desaparece de "Pendientes de Cobrar"
- [ ] Ir a "Pedidos Cobrados"
- [ ] Pedido aparece en la lista de cobrados

---

### PASO 4: Cobrar con TARJETA (Crear nuevo pedido)

1. Repetir PASO 1 y PASO 2 para crear otro pedido
2. Como caja, ir a "Pendientes de Cobrar"
3. Click en "Cobrar" en el nuevo pedido
4. Click en botón "💳 Tarjeta"

**✅ VERIFICAR SELECCIÓN DE TARJETA:**
- [ ] Botón de Tarjeta cambia a verde
- [ ] NO aparece input de monto recibido
- [ ] Botón "Confirmar Cobro" se habilita inmediatamente

5. Click en "✓ Confirmar Cobro"

**✅ VERIFICAR TICKET CON TARJETA:**
- [ ] Ticket se genera correctamente
- [ ] Muestra "Método de Pago: TARJETA"
- [ ] NO muestra "Recibido" ni "Cambio"

---

### PASO 5: Cobrar con TRANSFERENCIA

1. Repetir PASO 1 y PASO 2 para crear otro pedido
2. Como caja, ir a "Pendientes de Cobrar"
3. Click en "Cobrar"
4. Click en botón "📱 Transfer."

**✅ VERIFICAR SELECCIÓN DE TRANSFERENCIA:**
- [ ] Botón de Transferencia cambia a verde
- [ ] NO aparece input de monto recibido
- [ ] Botón "Confirmar Cobro" se habilita inmediatamente

5. Click en "✓ Confirmar Cobro"

**✅ VERIFICAR TICKET CON TRANSFERENCIA:**
- [ ] Ticket se genera correctamente
- [ ] Muestra "Método de Pago: TRANSFERENCIA"
- [ ] NO muestra "Recibido" ni "Cambio"

---

### PASO 6: Cancelar Modal de Pago

1. Crear otro pedido y prepararlo
2. Como caja, click en "Cobrar"
3. Seleccionar cualquier método de pago
4. Click en botón "Cancelar"

**✅ VERIFICAR CANCELACIÓN:**
- [ ] Modal se cierra
- [ ] Pedido NO se cobra
- [ ] Pedido sigue en "Pendientes de Cobrar"

5. Click en "Cobrar" nuevamente
6. Click FUERA del modal (en el fondo oscuro)

**✅ VERIFICAR CIERRE POR CLICK FUERA:**
- [ ] Modal se cierra
- [ ] Pedido NO se cobra

---

### PASO 7: Verificar Tickets Guardados

1. Ir a sección "Tickets"

**✅ VERIFICAR HISTORIAL:**
- [ ] Aparecen todos los tickets generados
- [ ] Cada ticket muestra:
  - Número de ticket
  - Número de pedido
  - Empleado
  - Fecha
  - Lista de productos
  - Total
  - Botón "Reimprimir"

2. Click en "Reimprimir" en cualquier ticket

**✅ VERIFICAR REIMPRESIÓN:**
- [ ] Ticket se muestra nuevamente
- [ ] Muestra marca "(REIMPRESIÓN)"
- [ ] Mantiene toda la información original

---

## 🐛 CASOS EDGE A PROBAR

### Caso 1: Decimales en Efectivo
1. Total: $45.50
2. Recibido: $50.25
3. **Verificar:** Cambio = $4.75 (correcto)

### Caso 2: Monto Exacto
1. Total: $45.00
2. Recibido: $45.00
3. **Verificar:** Cambio = $0.00

### Caso 3: Cambiar de Método
1. Seleccionar "Efectivo"
2. Cambiar a "Tarjeta"
3. **Verificar:** Input de efectivo desaparece
4. Volver a "Efectivo"
5. **Verificar:** Input reaparece

### Caso 4: Múltiples Productos
1. Agregar 3 productos diferentes
2. Cobrar con efectivo
3. **Verificar:** Ticket muestra todos los productos

### Caso 5: Productos con Personalizaciones
1. Agregar producto con personalizaciones
2. Cobrar
3. **Verificar:** Ticket muestra personalizaciones con asterisco

---

## ✅ CHECKLIST FINAL

### Funcionalidad del Modal:
- [ ] Modal se abre al hacer click en "Cobrar"
- [ ] Muestra total correcto
- [ ] 3 botones de método de pago visibles
- [ ] Solo un método puede estar seleccionado
- [ ] Botón confirmar deshabilitado inicialmente

### Pago con Efectivo:
- [ ] Input aparece solo con efectivo
- [ ] Cálculo de cambio es correcto
- [ ] Validación funciona (monto >= total)
- [ ] Cambio se muestra en verde

### Pago con Tarjeta/Transferencia:
- [ ] No muestra input de monto
- [ ] Botón se habilita inmediatamente
- [ ] Confirmación funciona

### Ticket:
- [ ] Formato estilo OXXO correcto
- [ ] Muestra método de pago
- [ ] Muestra recibido y cambio (solo efectivo)
- [ ] Personalizaciones visibles
- [ ] Botones Imprimir/Cancelar funcionan

### Flujo Completo:
- [ ] Pedido cambia a "Cobrado"
- [ ] Desaparece de "Pendientes"
- [ ] Aparece en "Cobrados"
- [ ] Ticket se guarda en historial
- [ ] Reimpresión funciona

---

## 🎯 RESULTADO ESPERADO

Si todas las pruebas pasan:
✅ **MEJORA #1 COMPLETADA Y FUNCIONAL**

Si encuentras errores:
❌ Anota los errores encontrados para corregirlos

---

## 📝 NOTAS

- El servidor debe estar corriendo en `http://localhost:3000`
- Usa diferentes navegadores si es posible (Chrome, Firefox, Edge)
- Prueba en diferentes resoluciones de pantalla
- Verifica la consola del navegador para errores JavaScript

---

## 🚀 DESPUÉS DE LAS PRUEBAS

Una vez completadas las pruebas:
1. Reporta cualquier bug encontrado
2. Si todo funciona, proceder con **Mejora #2: Cantidades Variables**
3. Si hay errores, corregirlos antes de continuar
