# 🍔 Boston Tracker - Sistema de Seguimiento de Entregas

Sistema completo de seguimiento en tiempo real para deliveries de **BOSTON American Burgers**. Incluye dashboard web para administradores, API backend robusta y aplicación móvil para repartidores.

## 🌟 Características Principales

- 📱 **App móvil React Native** para repartidores con tracking GPS
- 🌐 **Dashboard web React** para administradores  
- 🗄️ **API REST robusta** con Node.js y PostgreSQL
- 🔄 **Comunicación en tiempo real** con Socket.io
- 🗺️ **Mapas interactivos** con Leaflet y OpenStreetMap
- 📊 **Analytics y reportes** de deliveries
- 🎯 **Sistema de logs configurable** para debugging y producción
- ✅ **Gestión completa de viajes** con detalles y eliminación

## 🌐 URLs del Sistema

- **🌐 Dashboard Web:** http://185.144.157.71/
- **📄 Contratos y Términos:** http://185.144.157.71/contratos/
- **📱 Descarga APK:** http://185.144.157.71/apk/boston-tracker-latest.apk
- **🔌 API Backend:** http://185.144.157.71:5000/api/

## 🚀 Últimas Mejoras Implementadas

### ✨ Nuevas Funcionalidades
- **Endpoint de detalles de viaje**: `/api/trips/details/:id` con información completa
- **Eliminación de viajes**: Funcionalidad completa desde el dashboard
- **Sistema de logs avanzado**: Configuración por niveles (ERROR, WARN, INFO, DEBUG)
- **Información de delivery**: Visualización completa en historial y detalles

### 🐛 Correcciones de Errores
- **Conflictos de rutas**: Solucionados entre endpoints de viajes
- **Errores 404**: Corregidos al eliminar viajes desde el frontend
- **Datos faltantes**: Información de delivery ahora visible en todos los detalles
- **URLs del frontend**: Actualizadas para usar nuevas rutas del backend

### 🔧 Mejoras Técnicas
- **Logging centralizado**: Configuración única para toda la aplicación
- **Manejo de errores**: Mejorado en peticiones API
- **Experiencia de usuario**: Dashboard más responsivo y funcional
- **Optimización**: Reducción significativa de logs en producción

## 📂 Estructura del Proyecto

```
boston-tracker/
├── 📱 apk/           # Archivos APK para descarga
│   ├── boston-tracker-latest.apk
│   └── README.txt
├── 🖥️  backend/       # API y servidor Node.js
│   ├── server-postgres.js    # Servidor principal
│   ├── config/              # Configuraciones
│   ├── controllers/         # Controladores API
│   ├── models/             # Modelos de datos
│   ├── routes/             # Rutas de la API
│   ├── middleware/         # Middlewares
│   ├── package.json
│   └── README.md
├── 📄 contratos/     # Página de términos y contratos
│   └── index.html
├── 📚 docs/          # Documentación del proyecto
│   ├── ANEXO_INVENTARIO_TECNICO.md
│   ├── CHECKLIST_TRANSFERENCIA.md
│   ├── CONTRATO_VENTA_BOSTON_TRACKER.md
│   └── MEJORAS_IMPLEMENTADAS.md
├── 🌐 frontend/      # Dashboard web React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── services/        # Servicios API
│   │   ├── config/          # Configuraciones
│   │   │   └── logger.js    # Sistema de logs
│   │   └── context/         # Contextos React
│   ├── build/              # Archivos compilados
│   ├── package.json
│   └── README.md
├── 📱 mobile-app/    # Aplicación móvil React Native
│   ├── src/
│   ├── android/
│   ├── package.json
│   └── README.md
├── ⚙️  scripts/      # Scripts de utilidad
└── 📋 README.md      # Este archivo
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 16+ 
- PostgreSQL 12+
- Nginx (para servir el frontend)
- Git

### 1. Clonar el repositorio
```bash
git clone https://github.com/Scribax/BostonTracker.git
cd BostonTracker
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configurar variables de entorno
node server-postgres.js
```

### 3. Frontend Setup  
```bash
cd frontend
npm install
npm run build
# Copiar build/ a directorio web de Nginx
```

### 4. Database Setup
```bash
# Crear base de datos PostgreSQL
createdb boston_tracker
# El servidor creará las tablas automáticamente
```

## 🔌 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Información del usuario actual
- `GET /api/auth/users` - Listar usuarios (admin)

### Viajes
- `GET /api/trips/history` - Historial de viajes
- `GET /api/trips/details/:id` - **[NUEVO]** Detalles completos de viaje
- `DELETE /api/trips/details/:id` - **[NUEVO]** Eliminar viaje específico
- `POST /api/trips/start` - Iniciar viaje
- `POST /api/trips/end` - Finalizar viaje

### Deliveries
- `GET /api/deliveries` - Listar deliveries activos
- `GET /api/deliveries/:id/history` - Historial de delivery

### Ubicaciones
- `POST /api/location` - Registrar ubicación
- `GET /api/deliveries/:id/locations` - Ubicaciones de delivery

## 📊 Dashboard Web

El dashboard incluye:

- **🗺️ Mapa en tiempo real** con ubicaciones de deliveries
- **📋 Lista de deliveries** activos
- **📈 Historial de viajes** con búsqueda y filtros
- **👥 Gestión de usuarios** 
- **📱 Gestión de APK** para la app móvil
- **🔍 Detalles completos** de cada viaje con métricas
- **🗑️ Eliminación segura** de viajes completados

## 🏃‍♂️ Ejecutar en Desarrollo

### Backend
```bash
cd backend
npm run dev  # o node server-postgres.js
```

### Frontend
```bash  
cd frontend
npm start    # servidor de desarrollo
npm run build # compilar para producción
```

## 🎯 Sistema de Logging

### Configuración de Logs
El frontend incluye un sistema de logs configurable en `frontend/src/config/logger.js`:

```javascript
const LOG_LEVELS = {
  NONE: 0,    // Sin logs
  ERROR: 1,   // Solo errores críticos
  WARN: 2,    // Errores y advertencias
  INFO: 3,    // Información básica
  DEBUG: 4    // Todos los logs (desarrollo)
};
```

### Uso en Producción
Por defecto está configurado en `ERROR` para minimizar logs en consola. Para debugging completo cambiar a `DEBUG`.

## 🔐 Usuarios por Defecto

- **Admin**: admin@bostonburgers.com / password123
- **Delivery 1**: DEL001 / delivery123  
- **Delivery 2**: DEL002 / delivery123

## 📱 App Móvil

La aplicación móvil React Native incluye:
- Tracking GPS en tiempo real
- Interfaz para iniciar/finalizar viajes
- Envío automático de ubicaciones
- Notificaciones push

## 🛠️ Tecnologías Utilizadas

### Backend
- Node.js + Express
- PostgreSQL con Sequelize ORM
- Socket.io para tiempo real
- JWT para autenticación
- bcrypt para passwords

### Frontend  
- React 18 con Hooks
- Leaflet para mapas
- Axios para HTTP requests
- React Hot Toast para notificaciones
- Sistema de logging customizado

### Mobile
- React Native
- Expo (para desarrollo)
- React Navigation
- AsyncStorage

## 🚀 Deploy en Producción

El sistema está configurado para funcionar en:
- **Backend**: Puerto 5000
- **Frontend**: Servido por Nginx en puerto 80
- **Database**: PostgreSQL en puerto 5432

## 📞 Soporte

Para soporte técnico o consultas sobre el sistema, contactar al desarrollador a través del repositorio de GitHub.

## 📄 Licencia

Este proyecto es propiedad de BOSTON American Burgers. Todos los derechos reservados.

---

**Boston Tracker** - Sistema profesional de gestión de deliveries 🍔🚚
