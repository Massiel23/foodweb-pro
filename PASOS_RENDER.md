# 🚀 Pasos para Desplegar en Render - SOLUCIÓN AL ERROR

## ❌ El Error que tuviste:
```
El directorio raíz "main" no existe
```

## ✅ SOLUCIÓN:

### **Paso 1: Configurar Render correctamente**

1. **Ve a tu servicio en Render** (https://dashboard.render.com)
2. Haz clic en tu servicio `hotdogs`
3. Ve a **"Settings"** (menú izquierdo)

### **Paso 2: Corregir la configuración**

En la sección **"Build & Deploy"**, configura así:

- **Root Directory:** Déjalo **VACÍO** o pon un punto `.`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

### **Paso 3: Agregar PostgreSQL**

1. En Render Dashboard, haz clic en **"New +"**
2. Selecciona **"PostgreSQL"**
3. Configura:
   - **Name:** `hotdogs-db`
   - **Database:** `hotdogs`
   - **Region:** La misma que tu web service
   - **Plan:** **Free**
4. Haz clic en **"Create Database"**
5. Espera a que se cree (1-2 minutos)

### **Paso 4: Conectar la base de datos**

1. En tu base de datos PostgreSQL, copia la **"Internal Database URL"**
2. Ve a tu **Web Service** → **"Environment"**
3. Haz clic en **"Add Environment Variable"**
4. Agrega:
   - **Key:** `DATABASE_URL`
   - **Value:** (pega la URL que copiaste)
5. Haz clic en **"Save Changes"**

### **Paso 5: Usar el servidor actualizado**

**OPCIÓN A: Renombrar archivos (Recomendado)**

En tu computadora:
```bash
# Renombrar el servidor actual
mv server.js server-old.js

# Renombrar el nuevo servidor
mv server-production.js server.js

# Subir cambios a GitHub
git add .
git commit -m "Actualizar servidor para producción con PostgreSQL"
git push
```

**OPCIÓN B: Actualizar package.json**

Cambia en `package.json`:
```json
"scripts": {
  "start": "node server-production.js"
}
```

Luego:
```bash
git add package.json
git commit -m "Usar server-production.js"
git push
```

### **Paso 6: Redesplegar**

1. Ve a tu servicio en Render
2. Haz clic en **"Manual Deploy"** → **"Deploy latest commit"**
3. Espera 5-10 minutos
4. ¡Listo! Tu app estará funcionando

---

## 📋 Checklist Final

Antes de desplegar, verifica:

- [ ] `package.json` tiene `pg` en dependencies ✅ (Ya lo tienes)
- [ ] Root Directory está vacío o es `.`
- [ ] Build Command es `npm install`
- [ ] Start Command es `node server.js` (o `node server-production.js`)
- [ ] PostgreSQL creado en Render
- [ ] Variable `DATABASE_URL` agregada
- [ ] Código subido a GitHub
- [ ] Redesplegar en Render

---

## 🎯 Comandos Git Rápidos

```bash
# Ver estado
git status

# Agregar todos los cambios
git add .

# Hacer commit
git commit -m "Configurar para producción con PostgreSQL"

# Subir a GitHub
git push
```

---

## 🔍 Verificar que funciona

Una vez desplegado:

1. Ve a la URL de tu app: `https://tu-app.onrender.com`
2. Deberías ver la pantalla de login
3. Inicia sesión con:
   - Usuario: `admin`
   - Contraseña: `admin`

---

## 🐛 Si hay errores

1. Ve a **"Logs"** en Render
2. Busca mensajes de error
3. Los errores comunes son:
   - **"Cannot find module 'pg'"** → Ejecuta `npm install pg` y sube cambios
   - **"Port already in use"** → El código ya usa `process.env.PORT` ✅
   - **"Database connection failed"** → Verifica que `DATABASE_URL` esté configurada

---

## 💡 Diferencias entre Desarrollo y Producción

**En tu computadora (Desarrollo):**
- Usa SQLite (archivo `pos.db`)
- Puerto 3000
- Datos se guardan localmente

**En Render (Producción):**
- Usa PostgreSQL (en la nube)
- Puerto asignado por Render
- Datos se guardan en PostgreSQL

El archivo `server-production.js` detecta automáticamente dónde está corriendo y usa la base de datos correcta.

---

## ✅ ¡Listo!

Tu sistema POS estará disponible en internet 24/7 y podrás acceder desde cualquier dispositivo.

**URL de ejemplo:** `https://hotdogs-pos.onrender.com`
