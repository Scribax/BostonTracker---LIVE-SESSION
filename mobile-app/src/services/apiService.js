import axios from 'axios';
import Constants from 'expo-constants';

// Configuración de la API
const API_BASE_URL = __DEV__ 
  ? 'http://185.144.157.71:5000/api' // Servidor local con IP accesible desde móvil
  : 'http://185.144.157.71:5000/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.authToken = null;
    this.connectivityListeners = new Set();

    // Interceptor para requests
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Interceptor para responses
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        console.error('API Response Error:', error);
        
        // Manejar errores específicos
        if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
          return Promise.reject({
            success: false,
            error: 'Error de conexión. Verifica tu internet.'
          });
        }
        
        if (error.response) {
          const { status, data } = error.response;
          
          if (status === 401) {
            return Promise.reject({
              success: false,
              error: 'Sesión expirada. Por favor inicia sesión nuevamente.',
              shouldLogout: true
            });
          }
          
          return Promise.reject({
            success: false,
            error: data?.message || 'Error del servidor'
          });
        }
        
        return Promise.reject({
          success: false,
          error: error.message || 'Error desconocido'
        });
      }
    );
  }

  // Configurar token de autenticación
  setAuthToken(token) {
    this.authToken = token;
  }

  // Limpiar token de autenticación
  clearAuthToken() {
    this.authToken = null;
  }

  // Login
  async login(credentials) {
    try {
      const response = await this.client.post('/auth/login', credentials);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error en login'
        };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error de conexión'
      };
    }
  }

  // Logout
  async logout() {
    try {
      await this.client.post('/auth/logout');
      return { success: true };
    } catch (error) {
      console.error('Error en logout:', error);
      // Incluso si falla el logout en el servidor, consideramos exitoso localmente
      return { success: true };
    }
  }

  // Obtener usuario actual
  async getCurrentUser() {
    try {
      const response = await this.client.get('/auth/me');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.user
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error obteniendo usuario'
        };
      }
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error de conexión'
      };
    }
  }

  // Iniciar viaje
  async startTrip(userId, location = null) {
    try {
      const payload = {};
      
      if (location) {
        payload.latitude = location.latitude;
        payload.longitude = location.longitude;
        payload.accuracy = location.accuracy;
      }

      const response = await this.client.post(`/deliveries/${userId}/start`, payload);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error iniciando viaje'
        };
      }
    } catch (error) {
      console.error('Error iniciando viaje:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error iniciando viaje'
      };
    }
  }

  // 🔥 NUEVO: Enviar métricas en tiempo real
  async updateRealTimeMetrics(userId, metrics) {
    try {
      const response = await this.client.post(`/deliveries/${userId}/metrics`, metrics);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error actualizando métricas'
        };
      }
    } catch (error) {
      console.error('Error actualizando métricas:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error actualizando métricas'
      };
    }
  }

  // Detener viaje
  async stopTrip(userId) {
    try {
      const response = await this.client.post(`/deliveries/${userId}/stop`);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error deteniendo viaje'
        };
      }
    } catch (error) {
      console.error('Error deteniendo viaje:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error deteniendo viaje'
      };
    }
  }

  // Actualizar ubicación
  async updateLocation(userId, location) {
    try {
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || null
      };

      const response = await this.client.post(`/deliveries/${userId}/location`, payload);
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error actualizando ubicación'
        };
      }
    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error actualizando ubicación'
      };
    }
  }

  // Obtener viaje activo del usuario
  async getMyActiveTrip() {
    try {
      const response = await this.client.get('/deliveries/my-trip');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error obteniendo viaje activo'
        };
      }
    } catch (error) {
      console.error('Error obteniendo viaje activo:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error obteniendo viaje activo'
      };
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: false,
        error: error.error || error.message || 'Servidor no disponible'
      };
    }
  }

  // Notificar desconexión del delivery durante un viaje
  async notifyDeliveryDisconnection(disconnectionData) {
    try {
      const response = await this.client.post('/deliveries/notify-disconnection', disconnectionData);
      
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error notificando desconexión'
        };
      }
    } catch (error) {
      console.error('Error notificando desconexión:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error notificando desconexión'
      };
    }
  }

  // Notificar reconexión del delivery
  async notifyDeliveryReconnection(reconnectionData) {
    try {
      const response = await this.client.post('/deliveries/notify-reconnection', reconnectionData);
      
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error notificando reconexión'
        };
      }
    } catch (error) {
      console.error('Error notificando reconexión:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error notificando reconexión'
      };
    }
  }

  // 🚨 NUEVO: Enviar alerta de inactividad al dashboard
  async sendInactivityAlert(userId, alertData) {
    try {
      const response = await this.client.post(`/deliveries/${userId}/inactivity-alert`, alertData);
      
      if (response.data.success) {
        return {
          success: true,
          message: response.data.message
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Error enviando alerta de inactividad'
        };
      }
    } catch (error) {
      console.error('Error enviando alerta de inactividad:', error);
      return {
        success: false,
        error: error.error || error.message || 'Error enviando alerta de inactividad'
      };
    }
  }
}

// Crear instancia singleton
const apiService = new ApiService();

export default apiService;
