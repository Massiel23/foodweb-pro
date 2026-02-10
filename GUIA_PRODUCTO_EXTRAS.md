# 🎯 GUÍA DEL PRODUCTO EXTRAS

## 📋 DESCRIPCIÓN

Se ha agregado un nuevo producto llamado **EXTRAS** que permite a los empleados agregar ingredientes adicionales con precios individuales que se suman automáticamente al total del pedido.

---

## 💰 PRECIOS DE LOS EXTRAS

| Extra | Precio | Emoji |
|-------|--------|-------|
| **AGREGADOS** | $20 | 🥓 |
| **TOCINO** | $20 | 🥓 |
| **QUESO DERRETIDO** | $20 | 🧀 |
| **CHAMPIÑÓN** | $10 | 🍄 |
| **CEBOLLA ASADA** | $10 | 🧅 |
| **PAPA SAZONADA** | $20 | 🥔 |

---

## 🚀 CÓMO AGREGAR EL PRODUCTO EXTRAS

### Opción 1: Desde Render Shell (Producción)

1. Ve a Render Dashboard
2. Abre el **Shell** de tu Web Service
3. Ejecuta:
```bash
npm run add-extras
```

4. Deberías ver:
```
🔄 Agregando producto EXTRAS...
✅ Producto EXTRAS agregado exitosamente
   Nombre: EXTRAS
   Precio base: $0.00
   Emoji: ➕
```

### Opción 2: Desde Visual Studio Code (Local)

```bash
# Para SQLite (desarrollo local)
npm run add-extras

# Para PostgreSQL (con DATABASE_URL)
DATABASE_URL="tu-url-postgresql" npm run add-extras
```

---

## 🎨 CÓMO FUNCIONA

### 1. Agregar EXTRAS al Carrito

Cuando un empleado hace click en el producto **EXTRAS**, se abre una ventana de personalización especial con las siguientes opciones:

```
➕ EXTRAS - $0.00

Selecciona los extras:
☐ 🥓 AGREGADOS      +$20
☐ 🥓 TOCINO         +$20
☐ 🧀 QUESO DERRETIDO +$20
☐ 🍄 CHAMPIÑÓN      +$10
☐ 🧅 CEBOLLA ASADA  +$10
☐ 🥔 PAPA SAZONADA  +$20
```

### 2. Cálculo Automático del Total

El sistema calcula automáticamente el precio total basándose en:

**Fórmula:**
```
Total = (Precio Base + Suma de Extras) × Cantidad
```

**Ejemplo 1:**
- Producto: EXTRAS ($0)
- Extras seleccionados: TOCINO ($20) + QUESO DERRETIDO ($20)
- Cantidad: 1
- **Total: $40**

**Ejemplo 2:**
- Producto: EXTRAS ($0)
- Extras seleccionados: AGREGADOS ($20) + CHAMPIÑÓN ($10) + CEBOLLA ASADA ($10)
- Cantidad: 2
- **Total: $80** (($0 + $20 + $10 + $10) × 2)

### 3. Actualización en Tiempo Real

Cuando seleccionas o deseleccionas un extra, el total se actualiza automáticamente en la ventana de personalización.

---

## 📊 VISUALIZACIÓN EN EL CARRITO

Los extras se muestran en el carrito de la siguiente manera:

```
EXTRAS - $40.00
  TOCINO, QUESO DERRETIDO
```

O con cantidad:

```
2x EXTRAS @ $40.00 = $80.00
  AGREGADOS, CHAMPIÑÓN, CEBOLLA ASADA
```

---

## 🎯 CASOS DE USO

### Caso 1: Solo Extras
```
Cliente: "Quiero solo papas sazonadas"
Empleado: 
1. Agrega EXTRAS
2. Selecciona: PAPA SAZONADA ($20)
3. Cantidad: 1
Total: $20
```

### Caso 2: Múltiples Extras
```
Cliente: "Quiero tocino, queso y champiñones"
Empleado:
1. Agrega EXTRAS
2. Selecciona: TOCINO ($20) + QUESO DERRETIDO ($20) + CHAMPIÑÓN ($10)
3. Cantidad: 1
Total: $50
```

### Caso 3: Extras con Cantidad
```
Cliente: "Quiero 3 órdenes de agregados"
Empleado:
1. Agrega EXTRAS
2. Selecciona: AGREGADOS ($20)
3. Cantidad: 3
Total: $60
```

### Caso 4: Combinación de Productos
```
Cliente: "Un hot dog con todo y una orden de papas"
Empleado:
1. Agrega HOT DOG ($50)
   - Selecciona: con todo
2. Agrega EXTRAS
   - Selecciona: PAPA SAZONADA ($20)
Total: $70
```

---

## 🔧 CARACTERÍSTICAS TÉCNICAS

### Código Implementado

#### 1. Detección Automática
```javascript
const isExtras = name === 'EXTRAS';
```

#### 2. Opciones con Precios
```javascript
<input type="checkbox" value="TOCINO" data-price="20" class="extra-checkbox">
```

#### 3. Cálculo de Extras
```javascript
let extrasPrice = 0;
const extraCheckboxes = modal.querySelectorAll('.extra-checkbox:checked');
extraCheckboxes.forEach(checkbox => {
    const price = parseFloat(checkbox.getAttribute('data-price')) || 0;
    extrasPrice += price;
});
```

#### 4. Precio Total
```javascript
const totalUnitPrice = unitPrice + extrasPrice;
const itemTotal = totalUnitPrice * quantity;
```

#### 5. Actualización en Tiempo Real
```javascript
extraCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        updateQuantityDisplay(price);
    });
});
```

---

## ✅ VENTAJAS

1. **Flexibilidad**: Los clientes pueden pedir solo extras sin necesidad de un producto base
2. **Claridad**: Los precios se muestran claramente junto a cada opción
3. **Precisión**: El cálculo es automático y preciso
4. **Escalabilidad**: Fácil agregar más extras en el futuro
5. **UX Mejorada**: Actualización en tiempo real del total

---

## 🔄 ACTUALIZACIÓN EN TIEMPO REAL

Cuando el usuario:
- ✅ Selecciona un extra → El total se actualiza inmediatamente
- ✅ Deselecciona un extra → El total se recalcula
- ✅ Cambia la cantidad → El total se multiplica correctamente
- ✅ Combina extras → Los precios se suman correctamente

---

## 📝 EJEMPLO COMPLETO DE FLUJO

### Escenario: Cliente pide extras variados

1. **Empleado hace login**
   - Usuario: admin
   - Contraseña: Admin2026

2. **Va a Venta**
   - Click en "EXTRAS"

3. **Ventana de Personalización se abre**
   - Muestra: "EXTRAS - $0.00 c/u"
   - Opciones visibles con precios

4. **Empleado selecciona:**
   - ☑ TOCINO (+$20)
   - ☑ QUESO DERRETIDO (+$20)
   - ☑ CHAMPIÑÓN (+$10)
   - Total actualizado: $50.00

5. **Cambia cantidad a 2**
   - Total actualizado: $100.00

6. **Click en "Agregar al Carrito"**
   - Carrito muestra: "2x EXTRAS @ $50.00 = $100.00"
   - Debajo: "TOCINO, QUESO DERRETIDO, CHAMP"

7. **Envía el pedido**
   - Pedido creado con total correcto
   - Visible en "Pedidos Pendientes"

---

## 🎉 BENEFICIOS PARA EL NEGOCIO

1. **Mayor Flexibilidad**: Clientes pueden pedir solo lo que quieren
2. **Ventas Adicionales**: Fácil agregar extras a cualquier pedido
3. **Control de Precios**: Cada extra tiene su precio definido
4. **Reportes Precisos**: Los extras se contabilizan correctamente
5. **Experiencia Mejorada**: Interfaz clara y fácil de usar

---

## 🔍 VERIFICACIÓN

Para verificar que el producto EXTRAS fue agregado correctamente:

1. **Hacer login** como admin
2. **Ir a "Productos"**
3. **Buscar** el producto "EXTRAS" con emoji ➕
4. **Verificar** que aparece en la lista

---

## 🚀 PRÓXIMOS PASOS

Después de agregar el producto EXTRAS:

1. ✅ Hacer commit de los cambios
2. ✅ Push a GitHub
3. ✅ Esperar redespliegue en Render (3-5 min)
4. ✅ Ejecutar `npm run add-extras` en Render Shell
5. ✅ Probar la funcionalidad

---

## 📞 SOPORTE

Si tienes problemas:

1. **Producto no aparece**: Ejecuta `npm run add-extras` nuevamente
2. **Precios no se suman**: Verifica que los checkboxes tengan `data-price`
3. **Total no se actualiza**: Revisa la consola del navegador para errores

---

**¡El producto EXTRAS está listo para usar!** 🎉
