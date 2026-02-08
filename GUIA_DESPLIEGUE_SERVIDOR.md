# 🚀 Guía Completa: Desplegar Hot Dogs POS en un Servidor

Esta guía te explica paso a paso cómo subir tu sistema POS a internet para que puedas acceder desde cualquier lugar.

---

## 📋 Tabla de Contenidos
1. [Opción 1: Render (Recomendado - GRATIS)](#opción-1-render-recomendado---gratis)
2. [Opción 2: Railway (GRATIS)](#opción-2-railway-gratis)
3. [Opción 3: Vercel + Backend Separado](#opción-3-vercel--backend-separado)
4. [Preparar tu Proyecto](#preparar-tu-proyecto)

---

## 🎯 Opción 1: Render (Recomendado - GRATIS)

### **Paso 1: Preparar tu Proyecto**

#### 1.1 Crear archivo `package.json` (si no existe)
Abre la terminal en VS Code y ejecuta:
```bash
npm init -y
```

#### 1.2 Agregar dependencias al `package.json`
Abre `package.json` y asegúrate de que tenga esto:
```json
{
  "name": "hotdogs-pos",
  "version": "1.0.0",
  "description": "Sistema POS para Hot Dogs Callejones de Tamazula",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "socket.io": "^4.6.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

#### 1.3 Crear archivo `.gitignore`
Crea un archivo llamado `.gitignore` con este contenido:
```
node_modules/
pos.db
.DS_Store
*.log
.env
```

---

### **Paso 2: Subir a GitHub**

#### 2.1 Inicializar Git (si no está inicializado)
En la terminal de VS Code:
```bash
git init
git add .
git commit -m "Sistema POS Hot Dogs Callejones de Tamazula"
```

#### 2.2 Crear repositorio en GitHub
1. Ve a https://github.com
2. Haz clic en el **"+"** arriba a la derecha
3. Selecciona **"New repository"**
4. Nombre: `hotdogs-pos`
5. Descripción: "Sistema POS para Hot Dogs Callejones de Tamazula"
6. Público o Privado (tu elección)
7. **NO** marques "Add a README file"
8. Haz clic en **"Create repository"**

#### 2.3 Conectar y subir
Copia los comandos que GitHub te muestra (algo como esto):
```bash
git remote add origin https://github.com/TU-USUARIO/hotdogs-pos.git
git branch -M main
git push -u origin main
```

**Nota:** Si te pide autenticación, usa un Personal Access Token (no tu contraseña):
- Ve a GitHub → Settings → Developer settings → Personal access tokens
- Generate new token (classic)
- Selecciona permisos: `repo`
- Copia el token y úsalo como contraseña

---

### **Paso 3: Desplegar en Render**

#### 3.1 Crear cuenta en Render
1. Ve a https://render.com
2. Haz clic en **"Get Started"**
3. Regístrate con tu cuenta de GitHub (más fácil)

#### 3.2 Crear un nuevo Web Service
1. En el dashboard de Render, haz clic en **"New +"**
2. Selecciona **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Busca y selecciona `hotdogs-pos`

#### 3.3 Configurar el servicio
Completa estos campos:

- **Name:** `hotdogs-pos` (o el nombre que quieras)
- **Region:** Elige el más cercano a ti (ej: Oregon USA)
- **Branch:** `main`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Instance Type:** `Free` (gratis)

#### 3.4 Variables de entorno (opcional)
Si necesitas configurar el puerto:
- Haz clic en **"Advanced"**
- Agrega variable de entorno:
  - Key: `PORT`
  - Value: `3000`

#### 3.5 Desplegar
1. Haz clic en **"Create Web Service"**
2. Render comenzará a construir y desplegar tu aplicación
3. Espera 5-10 minutos (la primera vez tarda más)
4. Cuando termine, verás un mensaje: **"Your service is live 🎉"**

#### 3.6 Obtener tu URL
Tu aplicación estará disponible en:
```
https://hotdogs-pos.onrender.com
```
(o el nombre que hayas elegido)

---

### **Paso 4: Configurar la Base de Datos**

**IMPORTANTE:** Render usa un sistema de archivos efímero, lo que significa que SQLite se borrará cada vez que se reinicie el servidor.

#### Solución: Usar PostgreSQL (Recomendado para producción)

1. En Render, ve a **"New +"** → **"PostgreSQL"**
2. Nombre: `hotdogs-db`
3. Database: `hotdogs`
4. User: (se genera automáticamente)
5. Region: La misma que tu web service
6. Plan: **Free**
7. Haz clic en **"Create Database"**

8. Copia la **Internal Database URL**

9. En tu Web Service:
   - Ve a **"Environment"**
   - Agrega variable:
     - Key: `DATABASE_URL`
     - Value: (pega la URL de PostgreSQL)

10. **Actualiza tu código** para usar PostgreSQL en lugar de SQLite:

Instala el driver de PostgreSQL:
```bash
npm install pg
```

Modifica `server.js` para detectar si está en producción:
```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Usar PostgreSQL en producción, SQLite en desarrollo
const isProduction = process.env.DATABASE_URL !== undefined;

let db;
if (isProduction) {
    // PostgreSQL para producción
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    db = pool;
} else {
    // SQLite para desarrollo
    db = new sqlite3.Database('./pos.db', (err) => {
        if (err) console.error(err.message);
        console.log('Conectado a SQLite.');
    });
}
```

---

## 🚂 Opción 2: Railway (GRATIS)

### **Paso 1: Preparar el proyecto** (igual que Render)

### **Paso 2: Subir a GitHub** (igual que Render)

### **Paso 3: Desplegar en Railway**

1. Ve a https://railway.app
2. Haz clic en **"Start a New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway a acceder a GitHub
5. Selecciona tu repositorio `hotdogs-pos`
6. Railway detectará automáticamente que es Node.js
7. Haz clic en **"Deploy Now"**

### **Paso 4: Agregar PostgreSQL**
1. En tu proyecto de Railway, haz clic en **"New"**
2. Selecciona **"Database"** → **"PostgreSQL"**
3. Railway conectará automáticamente la base de datos
4. La variable `DATABASE_URL` se agregará automáticamente

### **Paso 5: Configurar dominio**
1. Ve a **"Settings"**
2. En **"Domains"**, haz clic en **"Generate Domain"**
3. Tu app estará en: `https://hotdogs-pos-production.up.railway.app`

---

## ☁️ Opción 3: Vercel + Backend Separado

Vercel es excelente para frontend, pero no soporta WebSockets ni bases de datos persistentes fácilmente.

### **Recomendación:**
- Frontend en Vercel (gratis)
- Backend en Render o Railway (gratis)

### **Pasos:**

1. **Separar frontend y backend:**
   - Crea carpeta `frontend/` con HTML, CSS, JS
   - Crea carpeta `backend/` con server.js

2. **Desplegar frontend en Vercel:**
   - Ve a https://vercel.com
   - Importa tu repositorio
   - Selecciona la carpeta `frontend/`
   - Deploy

3. **Desplegar backend en Render/Railway** (como se explicó arriba)

4. **Actualizar URLs en el frontend:**
   - En `api.js`, cambia `http://localhost:3000` por la URL de tu backend

---

## 🔧 Solución de Problemas Comunes

### **Error: "Application failed to respond"**
- Asegúrate de que `server.js` use `process.env.PORT`:
```javascript
const PORT = process.env.PORT || 3000;
```

### **Error: "Module not found"**
- Verifica que todas las dependencias estén en `package.json`
- Ejecuta `npm install` localmente para probar

### **La base de datos se borra**
- Cambia de SQLite a PostgreSQL (ver arriba)
- O usa un servicio de base de datos externo

### **WebSockets no funcionan**
- Asegúrate de que el servicio soporte WebSockets
- Render y Railway sí los soportan
- Vercel NO los soporta bien

---

## 📱 Acceder desde tu Celular

Una vez desplegado:
1. Abre el navegador en tu celular
2. Ve a la URL de tu aplicación (ej: `https://hotdogs-pos.onrender.com`)
3. ¡Listo! Puedes usarlo desde cualquier dispositivo

---

## 💰 Costos

### **Gratis (Recomendado para empezar):**
- **Render Free:** 750 horas/mes gratis
- **Railway Free:** $5 de crédito gratis al mes
- **Vercel Free:** Ilimitado para proyectos personales

### **Limitaciones del plan gratuito:**
- El servidor se "duerme" después de 15 minutos sin uso
- Tarda ~30 segundos en "despertar" al primer acceso
- Ancho de banda limitado

### **Planes de pago (si crece tu negocio):**
- **Render:** $7/mes (servidor siempre activo)
- **Railway:** $5/mes + uso
- **DigitalOcean:** $5/mes (VPS completo)

---

## ✅ Checklist Final

Antes de desplegar, verifica:

- [ ] `package.json` tiene todas las dependencias
- [ ] `.gitignore` excluye `node_modules/` y `pos.db`
- [ ] `server.js` usa `process.env.PORT`
- [ ] Código subido a GitHub
- [ ] Servicio creado en Render/Railway
- [ ] Base de datos PostgreSQL configurada (para producción)
- [ ] Aplicación desplegada y funcionando
- [ ] URL compartida con tu equipo

---

## 🎉 ¡Felicidades!

Tu sistema POS ya está en internet. Ahora puedes:
- Acceder desde cualquier dispositivo
- Compartir la URL con tu equipo
- Trabajar desde cualquier lugar

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render/Railway
2. Verifica que todas las dependencias estén instaladas
3. Asegúrate de que el puerto esté configurado correctamente

---

**Creado para:** Hot Dogs Callejones de Tamazula 🌭
**Fecha:** 2024
