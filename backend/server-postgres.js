const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Sequelize, DataTypes } = require('sequelize');

// Cargar variables de entorno
dotenv.config();

// Crear app Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.io con CORS
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://192.168.1.36:3000",
      "exp://192.168.1.36:8081",
    "http://185.144.157.163",
    "http://185.144.157.163:3000",
    "http://185.144.157.163:5000"
    ],
    methods: ["GET", "POST"]
  }
});

// Configurar Sequelize con PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'boston_tracker',
  process.env.DB_USER || 'boston_user', 
  process.env.DB_PASSWORD || 'boston123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false // Desactivar logs SQL en consola
  }
);

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: true, // Permitir todos los origenes para mobile
  origin: [
    "http://localhost:3000",
    "http://192.168.1.36:3000",
    "exp://192.168.1.36:8081",
    "http://185.144.157.163",
    "http://185.144.157.163:3000",
    "http://185.144.157.163:5000"
  ],
  credentials: true
}));

// Rate limiting - Configurado para tracking de alta frecuencia
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 peticiones por minuto (permite tracking cada 300ms)
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta de nuevo en un momento'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter especial para endpoints de ubicación (más permisivo)
const locationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto  
  max: 300, // 300 peticiones por minuto para ubicaciones
  message: {
    success: false,
    message: 'Límite de actualizaciones de ubicación alcanzado'
  }
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// MIDDLEWARE DE LOGGING DETALLADO
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📝 ${timestamp} - ${req.method} ${req.originalUrl}`);
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  if (Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});
app.use(express.urlencoded({ extended: true }));

// MODELOS DE SEQUELIZE

// Modelo Usuario
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  employeeId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'delivery'),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

// Modelo Trip
const Trip = sequelize.define('Trip', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deliveryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'completed'),
    defaultValue: 'active'
  },
  mileage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  averageSpeed: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  realTimeMetrics: {
    type: DataTypes.TEXT, // JSON string
    allowNull: true
  }
});

// Modelo Location
const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tripId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Trip,
      key: 'id'
    }
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false
  },
  accuracy: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Relaciones
User.hasMany(Trip, { foreignKey: 'deliveryId', as: 'trips' });
Trip.belongsTo(User, { foreignKey: 'deliveryId', as: 'delivery' });
Trip.hasMany(Location, { foreignKey: 'tripId', as: 'locations' });
Location.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });

// FUNCIONES DE CÁLCULO DE DISTANCIAS

// Fórmula Haversine ultra precisa para cálculo de distancias
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
  // Radio de la Tierra en kilómetros
  const R = 6371.0;
  
  // Convertir grados a radianes
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  
  // Fórmula Haversine
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
           Math.cos(lat1Rad) * Math.cos(lat2Rad) *
           Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distancia en kilómetros
  const distance = R * c;
  
  return distance;
}

// Calcular distancia total de un array de ubicaciones
function calculateTotalDistance(locations) {
  if (!locations || locations.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 1; i < locations.length; i++) {
    const prevLocation = locations[i - 1];
    const currentLocation = locations[i];
    
    const segmentDistance = calculateHaversineDistance(
      prevLocation.latitude,
      prevLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );
    
    // Solo sumar si la distancia es razonable (menos de 1km entre puntos consecutivos)
    // Esto ayuda a filtrar errores de GPS
    if (segmentDistance < 1.0 && segmentDistance > 0.001) {
      totalDistance += segmentDistance;
    }
  }
  
  return totalDistance;
}

// Filtrar ubicaciones para remover ruido de GPS
function filterGPSNoise(locations, minDistanceMeters = 5) {
  if (!locations || locations.length < 2) return locations;
  
  const filtered = [locations[0]]; // Siempre incluir la primera ubicación
  
  for (let i = 1; i < locations.length; i++) {
    const lastFiltered = filtered[filtered.length - 1];
    const current = locations[i];
    
    const distance = calculateHaversineDistance(
      lastFiltered.latitude,
      lastFiltered.longitude,
      current.latitude,
      current.longitude
    );
    
    // Solo incluir si se movió más de la distancia mínima (en km)
    if (distance > minDistanceMeters / 1000) {
      filtered.push(current);
    }
  }
  
  return filtered;
}

// Generar JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Middleware de autenticación
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Token no válido, usuario no encontrado'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token no válido'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'No autorizado, token requerido'
    });
  }
};

// RUTAS DE API

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, employeeId, password } = req.body;

    let user;
    if (email) {
      user = await User.findOne({ where: { email, role: 'admin' } });
    } else if (employeeId) {
      user = await User.findOne({ where: { employeeId, role: 'delivery' } });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const token = generateToken(user.id);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Logout
app.post("/api/auth/logout", protect, (req, res) => {
  try {
    // En JWT no necesitamos hacer nada en el servidor
    // El cliente debe eliminar el token
    res.json({
      success: true,
      message: "Sesión cerrada exitosamente"
    });
  } catch (error) {
    console.error("Error en logout:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});

// Usuario actual
app.get('/api/auth/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      employeeId: req.user.employeeId,
      role: req.user.role
    }
  });
});

// Deliveries activos (solo admins)
app.get('/api/deliveries', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'No autorizado'
    });
  }

  try {
    const activeTrips = await Trip.findAll({
      where: { status: 'active' },
      include: [
        {
          model: User,
          as: 'delivery',
          attributes: ['name', 'employeeId']
        },
        {
          model: Location,
          as: 'locations',
          order: [['timestamp', 'DESC']],
          limit: 1
        }
      ]
    });

    // Formatear datos para el frontend
    const formattedTrips = activeTrips.map(trip => ({
      id: trip.id,
      deliveryId: trip.deliveryId,
      deliveryName: trip.delivery.name,
      employeeId: trip.delivery.employeeId,
      startTime: trip.startTime,
      endTime: trip.endTime,
      status: trip.status,
      mileage: trip.mileage,
      duration: trip.duration,
      averageSpeed: trip.averageSpeed,
      currentLocation: trip.locations.length > 0 ? {
        latitude: trip.locations[0].latitude,
        longitude: trip.locations[0].longitude,
        timestamp: trip.locations[0].timestamp
      } : null
    }));
    
    res.json({
      success: true,
      count: formattedTrips.length,
      data: formattedTrips
    });
  } catch (error) {
    console.error('Error obteniendo deliveries:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo deliveries'
    });
  }
});

// Iniciar viaje
app.post('/api/deliveries/:id/start', protect, async (req, res) => {
  const { latitude, longitude } = req.body;
  const deliveryId = req.params.id;

  try {
    const delivery = await User.findOne({ 
      where: { id: deliveryId, role: 'delivery' } 
    });
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery no encontrado'
      });
    }

    // Verificar que no hay viaje activo
    const existingTrip = await Trip.findOne({
      where: { deliveryId, status: 'active' }
    });

    if (existingTrip) {
      return res.status(400).json({
        success: false,
        message: 'Ya hay un viaje activo'
      });
    }

    const newTrip = await Trip.create({
      deliveryId: deliveryId,
      startTime: new Date(),
      status: 'active',
      mileage: 0,
      duration: 0,
      averageSpeed: 0
    });

    if (latitude && longitude) {
      await Location.create({
        tripId: newTrip.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      });
    }

    // Emitir a admins
    io.to('admins').emit('tripStarted', {
      tripId: newTrip.id,
      deliveryId: newTrip.deliveryId,
      deliveryName: delivery.name,
      startTime: newTrip.startTime,
      currentLocation: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      } : null
    });
    
    // Emitir al delivery específico
    io.to(`delivery-${deliveryId}`).emit('tripStatusChanged', {
      action: 'started',
      tripId: newTrip.id,
      status: 'active',
      startTime: newTrip.startTime,
      mileage: newTrip.mileage
    });

    res.status(201).json({
      success: true,
      message: 'Viaje iniciado exitosamente',
      data: {
        tripId: newTrip.id,
        deliveryName: delivery.name,
        startTime: newTrip.startTime,
        mileage: newTrip.mileage,
        status: newTrip.status
      }
    });
  } catch (error) {
    console.error('Error iniciando viaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error iniciando viaje'
    });
  }
});

// Actualizar ubicación - Rate limiter específico para alta frecuencia
app.post('/api/deliveries/:id/location', locationLimiter, protect, async (req, res) => {
  const { latitude, longitude } = req.body;
  const deliveryId = req.params.id;

  try {
    const trip = await Trip.findOne({
      where: { deliveryId, status: 'active' },
      include: [{ model: User, as: 'delivery' }]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'No hay viaje activo'
      });
    }

    // Crear nueva ubicación
    const newLocation = await Location.create({
      tripId: trip.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: new Date()
    });

    // Obtener todas las ubicaciones del viaje para calcular distancia precisa
    const allLocations = await Location.findAll({
      where: { tripId: trip.id },
      order: [['timestamp', 'ASC']]
    });

    // Calcular distancia total usando Haversine preciso
    const filteredLocations = filterGPSNoise(allLocations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp
    })));
    
    const newMileage = calculateTotalDistance(filteredLocations);
    const duration = Math.floor((new Date() - new Date(trip.startTime)) / 1000 / 60);
    const averageSpeed = duration > 0 && newMileage > 0 ? 
      Math.round((newMileage / duration) * 60 * 100) / 100 : 0;

    // Actualizar trip con cálculos precisos
    await trip.update({
      mileage: Math.round(newMileage * 1000) / 1000, // Redondear a 3 decimales
      duration,
      averageSpeed
    });

    // Emitir a admins
    io.to('admins').emit('locationUpdate', {
      tripId: trip.id,
      deliveryId: trip.deliveryId,
      deliveryName: trip.delivery.name,
      currentLocation: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      },
      mileage: newMileage,
      duration,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Ubicación actualizada',
      data: {
        mileage: newMileage,
        currentLocation: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          timestamp: new Date()
        },
        duration
      }
    });
  } catch (error) {
    console.error('Error actualizando ubicación:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando ubicación'
    });
  }
});

// 🔥 NUEVO: Actualizar métricas en tiempo real
app.post('/api/deliveries/:id/metrics', protect, async (req, res) => {
  const deliveryId = req.params.id;
  const { 
    currentSpeed, 
    averageSpeed, 
    maxSpeed, 
    totalDistanceM, 
    totalTime, 
    validLocations,
    latitude,
    longitude,
    accuracy
  } = req.body;

  try {
    const trip = await Trip.findOne({
      where: { deliveryId, status: 'active' },
      include: [{ model: User, as: 'delivery' }]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'No hay viaje activo para este delivery'
      });
    }

    // Crear o actualizar campo realTimeMetrics en el modelo
    let realTimeMetrics = {
      currentSpeed: Math.round(currentSpeed || 0),
      averageSpeed: Math.round((averageSpeed || 0) * 10) / 10,
      maxSpeed: Math.round(maxSpeed || 0),
      totalTime: totalTime || 0,
      validLocations: validLocations || 0,
      lastSpeedUpdate: new Date()
    };
    
    // Actualizar mileage con datos precisos si viene de la app
    let updateData = {
      realTimeMetrics: JSON.stringify(realTimeMetrics)
    };
    
    if (totalDistanceM && totalDistanceM > 0) {
      updateData.mileage = totalDistanceM / 1000; // Convertir metros a km
    }
    
    await trip.update(updateData);
    
    // Actualizar ubicación si viene
    if (latitude && longitude) {
      await Location.create({
        tripId: trip.id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy || null,
        timestamp: new Date()
      });
    }
    
    // 🔥 EMITIR MÉTRICAS AVANZADAS AL DASHBOARD
    io.to('admins').emit('realTimeMetricsUpdate', {
      tripId: trip.id,
      deliveryId: trip.deliveryId,
      deliveryName: trip.delivery.name,
      currentLocation: latitude && longitude ? {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp: new Date()
      } : null,
      mileage: trip.mileage,
      duration: Math.floor((new Date() - new Date(trip.startTime)) / 1000 / 60),
      realTimeMetrics: realTimeMetrics,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Métricas actualizadas',
      data: {
        mileage: trip.mileage,
        currentLocation: latitude && longitude ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          timestamp: new Date()
        } : null,
        duration: Math.floor((new Date() - new Date(trip.startTime)) / 1000 / 60),
        realTimeMetrics: realTimeMetrics
      }
    });
    
  } catch (error) {
    console.error('Error actualizando métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Detener viaje
app.post('/api/deliveries/:id/stop', protect, async (req, res) => {
  const deliveryId = req.params.id;

  try {
    const trip = await Trip.findOne({
      where: { deliveryId, status: 'active' },
      include: [{ model: User, as: 'delivery' }]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'No hay viaje activo para detener'
      });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - new Date(trip.startTime)) / 1000 / 60);
    
    await trip.update({
      endTime,
      status: 'completed',
      duration
    });

    // Emitir a admins
    io.to('admins').emit('tripCompleted', {
      tripId: trip.id,
      deliveryId: trip.deliveryId,
      deliveryName: trip.delivery.name,
      totalMileage: trip.mileage,
      totalDuration: duration,
      endTime
    });
    
    // Emitir al delivery específico que debe parar
    io.to(`delivery-${deliveryId}`).emit('tripStatusChanged', {
      action: 'stopped',
      tripId: trip.id,
      status: 'completed',
      endTime: endTime,
      totalMileage: trip.mileage,
      totalDuration: duration
    });

    res.json({
      success: true,
      message: 'Viaje detenido exitosamente',
      data: {
        tripId: trip.id,
        deliveryName: trip.delivery.name,
        totalMileage: trip.mileage,
        totalDuration: duration,
        endTime
      }
    });
  } catch (error) {
    console.error('Error deteniendo viaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error deteniendo viaje'
    });
  }
});

// Mi viaje activo (para deliverys)
app.get('/api/deliveries/my-trip', protect, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      where: { deliveryId: req.user.id, status: 'active' }
    });

    res.json({
      success: true,
      data: trip || null
    });
  } catch (error) {
    console.error('Error obteniendo mi viaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo viaje activo'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Boston Tracker API funcionando (PostgreSQL)',
    timestamp: new Date().toISOString() 
  });
});

// ================== RUTAS DE GESTIÓN DE USUARIOS ==================

// Obtener todos los usuarios (solo admin)
app.get('/api/auth/users', protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    // Obtener todos los usuarios excepto la contraseña
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    // Obtener información de viajes activos
    const usersWithTripInfo = await Promise.all(
      users.map(async (user) => {
        const userObj = user.toJSON();
        
        // Solo buscar viajes para usuarios con rol delivery
        if (user.role === 'delivery') {
          const activeTrip = await Trip.findOne({
            where: {
              deliveryId: user.id,
              status: 'active'
            }
          });
          
          userObj.hasActiveTrip = !!activeTrip;
          userObj.activeTripId = activeTrip?.id;
          userObj.tripStartTime = activeTrip?.startTime;
          userObj.currentMileage = activeTrip?.mileage || 0;
        } else {
          userObj.hasActiveTrip = false;
        }
        
        return userObj;
      })
    );

    res.json({
      success: true,
      data: usersWithTripInfo,
      count: usersWithTripInfo.length
    });

  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Crear nuevo usuario (solo admin)
app.post('/api/auth/users', protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const { name, email, employeeId, password, phone, role = 'delivery', isActive = true } = req.body;

    // Validación de campos requeridos
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y contraseña son requeridos'
      });
    }

    // Para deliveries, employeeId es requerido; para admins, email es requerido
    if (role === 'delivery' && !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'ID de empleado es requerido para deliveries'
      });
    }

    if (role === 'admin' && !email) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido para administradores'
      });
    }

    // Verificar si el email ya existe (si se proporciona)
    if (email) {
      const existingUserByEmail = await User.findOne({ where: { email } });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con este email'
        });
      }
    }

    // Verificar si el employeeId ya existe (si se proporciona)
    if (employeeId) {
      const existingUserByEmployeeId = await User.findOne({ where: { employeeId } });
      if (existingUserByEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con este ID de empleado'
        });
      }
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear nuevo usuario
    const user = await User.create({
      name,
      email: email || null,
      employeeId: employeeId || null,
      password: hashedPassword,
      phone: phone || null,
      role,
      isActive
    });

    // Devolver usuario sin contraseña
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: userResponse
    });

  } catch (error) {
    console.error('Error creando usuario:', error);
    
    // Manejar errores de validación de Sequelize
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: error.errors ? error.errors[0].message : error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Actualizar usuario (solo admin)
app.put('/api/auth/users/:id', protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const userId = req.params.id;
    const { name, email, employeeId, password, phone, isActive } = req.body;

    // Buscar usuario a actualizar
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Prevenir que el admin se desactive a sí mismo
    if (user.id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta'
      });
    }

    // Verificar unicidad de email (si se está cambiando)
    if (email && email !== user.email) {
      const existingUserByEmail = await User.findOne({ 
        where: { 
          email,
          id: { [sequelize.Op.ne]: userId }
        }
      });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro usuario con este email'
        });
      }
    }

    // Verificar unicidad de employeeId (si se está cambiando)
    if (employeeId && employeeId !== user.employeeId) {
      const existingUserByEmployeeId = await User.findOne({ 
        where: { 
          employeeId,
          id: { [sequelize.Op.ne]: userId }
        }
      });
      if (existingUserByEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro usuario con este ID de empleado'
        });
      }
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (name) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (employeeId !== undefined) updateData.employeeId = employeeId || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Actualizar contraseña si se proporciona
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    // Devolver usuario actualizado sin contraseña
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: userResponse
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    
    // Manejar errores de validación de Sequelize
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: error.errors ? error.errors[0].message : error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Eliminar usuario (solo admin)
app.delete('/api/auth/users/:id', protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    const userId = req.params.id;

    // Buscar usuario a eliminar
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Prevenir que el admin se elimine a sí mismo
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta'
      });
    }

    // Verificar si tiene viajes activos
    const activeTrip = await Trip.findOne({
      where: {
        deliveryId: userId,
        status: 'active'
      }
    });

    if (activeTrip) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un usuario con viajes activos. Detén el viaje primero.'
      });
    }
    
    // Eliminar usuario
    await user.destroy();

    res.json({
      success: true,
      message: `Usuario ${user.name} eliminado exitosamente`
    });

  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});


// ================== RUTAS DE HISTORIAL DE VIAJES ==================

// Obtener historial de viajes completados (solo admin)
app.get("/api/trips/history", protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. Se requieren permisos de administrador."
      });
    }

    const { page = 1, limit = 20, sortBy = "endTime", sortOrder = "DESC" } = req.query;
    const offset = (page - 1) * limit;

    // Obtener viajes completados con información del delivery
    const { count, rows: trips } = await Trip.findAndCountAll({
      where: { status: "completed" },
      include: [
        {
          model: User,
          as: "delivery",
          attributes: ["name", "employeeId"]
        },
        {
          model: Location,
          as: "locations",
          attributes: ["latitude", "longitude", "timestamp"],
          order: [["timestamp", "ASC"]]
        }
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Formatear datos para el frontend
    const formattedTrips = trips.map(trip => {
      const locations = trip.locations || [];
      const startLocation = locations.length > 0 ? locations[0] : null;
      const endLocation = locations.length > 0 ? locations[locations.length - 1] : null;
      
      return {
        id: trip.id,
        deliveryId: trip.deliveryId,
        deliveryName: trip.delivery.name,
        employeeId: trip.delivery.employeeId,
        startTime: trip.startTime,
        endTime: trip.endTime,
        duration: trip.duration, // en minutos
        mileage: Math.round(trip.mileage * 1000) / 1000, // km con 3 decimales
        averageSpeed: trip.averageSpeed,
        totalLocations: locations.length,
        startLocation: startLocation ? {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          timestamp: startLocation.timestamp
        } : null,
        endLocation: endLocation ? {
          latitude: endLocation.latitude,
          longitude: endLocation.longitude,
          timestamp: endLocation.timestamp
        } : null,
        realTimeMetrics: trip.realTimeMetrics ? JSON.parse(trip.realTimeMetrics) : null,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt
      };
    });
    
    res.json({
      success: true,
      data: formattedTrips,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error("Error obteniendo historial de viajes:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo historial de viajes"
    });
  }
});

// Obtener detalles de un viaje específico (solo admin)
app.get("/api/trips/:id", protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. Se requieren permisos de administrador."
      });
    }

    const tripId = req.params.id;
    
    const trip = await Trip.findByPk(tripId, {
      include: [
        {
          model: User,
          as: "delivery",
          attributes: ["name", "employeeId", "phone"]
        },
        {
          model: Location,
          as: "locations",
          order: [["timestamp", "ASC"]]
        }
      ]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }
    
    // Calcular estadísticas adicionales
    const locations = trip.locations || [];
    const routePoints = locations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp
    }));
    
    res.json({
      success: true,
      data: {
        id: trip.id,
        deliveryId: trip.deliveryId,
        deliveryName: trip.delivery.name,
        employeeId: trip.delivery.employeeId,
        deliveryPhone: trip.delivery.phone,
        startTime: trip.startTime,
        endTime: trip.endTime,
        duration: trip.duration,
        mileage: trip.mileage,
        averageSpeed: trip.averageSpeed,
        status: trip.status,
        totalLocations: locations.length,
        routePoints: routePoints,
        realTimeMetrics: trip.realTimeMetrics ? JSON.parse(trip.realTimeMetrics) : null,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt
      }
    });
    
  } catch (error) {
    console.error("Error obteniendo detalles del viaje:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo detalles del viaje"
    });
  }
});

// Eliminar viaje del historial (solo admin)
app.delete("/api/trips/:id", protect, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado. Se requieren permisos de administrador."
      });
    }

    const tripId = req.params.id;
    
    // Buscar el viaje
    const trip = await Trip.findByPk(tripId, {
      include: [{ model: User, as: "delivery", attributes: ["name", "employeeId"] }]
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Viaje no encontrado"
      });
    }
    
    // No permitir eliminar viajes activos
    if (trip.status === "active") {
      return res.status(400).json({
        success: false,
        message: "No se puede eliminar un viaje activo. Debe completarse primero."
      });
    }
    
    // Eliminar primero las ubicaciones asociadas
    await Location.destroy({ where: { tripId: tripId } });
    
    // Luego eliminar el viaje
    await trip.destroy();
    
    res.json({
      success: true,
      message: `Viaje de ${trip.delivery.name} (${trip.delivery.employeeId}) eliminado exitosamente`,
      deletedTrip: {
        id: trip.id,
        deliveryName: trip.delivery.name,
        employeeId: trip.delivery.employeeId,
        startTime: trip.startTime,
        endTime: trip.endTime,
        mileage: trip.mileage
      }
    });
    
  } catch (error) {
    console.error("Error eliminando viaje:", error);
    res.status(500).json({
      success: false,
      message: "Error eliminando viaje del historial"
    });
  }
});


// Socket.io
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  // Admin se une a la sala de admins
  socket.on('join-admin', () => {
    socket.join('admins');
    console.log('👔 Admin se unió al room');
  });

  // Delivery se une a su sala específica
  socket.on('join-delivery', (deliveryId) => {
    if (deliveryId) {
      socket.join(`delivery-${deliveryId}`);
      console.log(`🚚 Delivery ${deliveryId} se unió a su room específico`);
    }
  });

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 5000;

// Función para crear usuarios de prueba
async function createTestUsers() {
  try {
    // Crear admin
    const adminExists = await User.findOne({ where: { email: 'admin@bostonburgers.com' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.create({
        name: 'Administrador Boston',
        email: 'admin@bostonburgers.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      console.log('✅ Usuario admin creado');
    }

    // Crear deliverys de prueba
    const delivery1Exists = await User.findOne({ where: { employeeId: 'DEL001' } });
    if (!delivery1Exists) {
      const hashedPassword = await bcrypt.hash('delivery123', 10);
      await User.create({
        name: 'Juan Pérez',
        employeeId: 'DEL001',
        password: hashedPassword,
        role: 'delivery',
        isActive: true
      });
      console.log('✅ Usuario delivery DEL001 creado');
    }

    const delivery2Exists = await User.findOne({ where: { employeeId: 'DEL002' } });
    if (!delivery2Exists) {
      const hashedPassword = await bcrypt.hash('delivery123', 10);
      await User.create({
        name: 'María González',
        employeeId: 'DEL002',
        password: hashedPassword,
        role: 'delivery',
        isActive: true
      });
      console.log('✅ Usuario delivery DEL002 creado');
    }

  } catch (error) {
    console.error('Error creando usuarios de prueba:', error);
  }
}

// Iniciar servidor
async function startServer() {
  try {
    // Conectar a PostgreSQL
    await sequelize.authenticate();
    console.log('✅ Conectado a PostgreSQL exitosamente');
    
    // Sincronizar modelos
    await sequelize.sync({ force: false });
    console.log('✅ Modelos sincronizados');
    
    // Crear usuarios de prueba
    await createTestUsers();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT} (PostgreSQL)`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV}`);
      console.log(`🔗 Accesible en: http://192.168.1.36:${PORT}`);
      console.log('📋 Usuarios del sistema disponibles');
      console.log('   Para administradores: Usar panel web');
      console.log('   Para deliverys: Usar aplicación móvil');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

startServer();
