# 🔧 Solución al Problema de Login

## ❌ Problema
No se puede iniciar sesión con admin/admin

## ✅ Solución

La base de datos tenía datos antiguos del sistema anterior. He creado un script para resetearla.

### Pasos para Solucionar:

#### 1. Detener el servidor si está corriendo
Presiona `Ctrl + C` en la terminal donde está corriendo el servidor

#### 2. Resetear la base de datos
```bash
npm run reset-db
```

Este comando:
- ✅ Elimina la base de datos antigua (pos.db)
- ✅ Crea una nueva base de datos limpia
- ✅ Crea todas las tablas necesarias
- ✅ Inserta usuarios por defecto (admin y caja)
- ✅ Inserta productos por defecto

#### 3. Iniciar el servidor nuevamente
```bash
npm start
```

#### 4. Abrir el navegador
```
http://localhost:3000
```

#### 5. Iniciar sesión
- **Usuario**: `admin`
- **Contraseña**: `admin`

O

- **Usuario**: `caja`
- **Contraseña**: `caja`

---

## 🔍 Verificación

Si quieres verificar que los usuarios están en la base de datos:

```bash
# Opción 1: Usar el script de prueba
npm test

# Opción 2: Ver directamente la base de datos (si tienes sqlite3)
sqlite3 pos.db "SELECT * FROM users;"
```

---

## 📝 Comandos Disponibles

```bash
npm start        # Iniciar servidor
npm run dev      # Iniciar con auto-reinicio (desarrollo)
npm run reset-db # Resetear base de datos
npm test         # Probar API
```

---

## 🐛 Si el Problema Persiste

### Verificar que el servidor está corriendo:
1. Debes ver en la terminal: "Servidor corriendo en http://localhost:3000"
2. Debes ver: "Conectado a SQLite."

### Verificar en el navegador:
1. Abre las DevTools (F12)
2. Ve a la pestaña "Console"
3. Intenta hacer login
4. Busca errores en rojo

### Errores Comunes:

#### Error: "Failed to fetch" o "Network Error"
**Causa**: El servidor no está corriendo
**Solución**: Ejecuta `npm start`

#### Error: "Credenciales inválidas"
**Causa**: La base de datos no tiene los usuarios
**Solución**: Ejecuta `npm run reset-db` y luego `npm start`

#### Error: "Cannot find module"
**Causa**: Dependencias no instaladas
**Solución**: Ejecuta `npm install`

---

## 🎯 Flujo Completo de Instalación

Si quieres empezar desde cero:

```bash
# 1. Instalar dependencias
npm install

# 2. Resetear base de datos
npm run reset-db

# 3. Iniciar servidor
npm start

# 4. Abrir navegador en http://localhost:3000

# 5. Login con admin/admin
```

---

## ✅ Checklist de Verificación

- [ ] Dependencias instaladas (`npm install`)
- [ ] Base de datos reseteada (`npm run reset-db`)
- [ ] Servidor corriendo (`npm start`)
- [ ] Navegador abierto en `localhost:3000`
- [ ] No hay errores en la consola del navegador (F12)
- [ ] Login funciona con admin/admin

---

## 📞 Información Adicional

### Usuarios por Defecto
| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin   | admin      | admin |
| caja    | caja       | caja |

### Productos por Defecto
- 🐕 Hot Dog Clásico - $5.00
- 🐶 Hot Dog con Queso - $6.50
- 🐕‍🦺 Hot Dog Deluxe - $8.00
- 🥤 Bebida Refresco - $2.00
- 🌱 Hot Dog Veggie - $7.00
- 🥗 Ensalada Fresca - $4.50

---

**¡El sistema debería funcionar correctamente ahora!** 🎉
