import React, { useState, useEffect, useCallback } from 'react';
import { 
  Container, 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Row, 
  Col, 
  Card,
  Spinner,
  Alert,
  Pagination,
  Form,
  InputGroup,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import tripService from '../services/tripService';

const TripHistory = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tripToDelete, setTripToDelete] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [sortBy, setSortBy] = useState('endTime');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar historial de viajes
  const loadTripHistory = useCallback(async () => {
    try {
      setLoading(true);
      const result = await tripService.getTripHistory({
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder
      });
      
      if (result && result.success) {
        setTrips(result.data || []);
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 0
        }));
      } else {
        toast.error('Error cargando historial de viajes');
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      toast.error('Error cargando historial de viajes');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  useEffect(() => {
    loadTripHistory();
  }, [loadTripHistory]);

  // Filtrar viajes por término de búsqueda
  const filteredTrips = trips.filter(trip => 
    trip.deliveryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Manejar eliminación de viaje
  const handleDeleteTrip = async () => {
    if (!tripToDelete) return;

    try {
      const result = await tripService.deleteTrip(tripToDelete.id);
      
      if (result && result.success) {
        toast.success(`Viaje de ${tripToDelete.deliveryName} eliminado`);
        setTrips(prev => prev.filter(trip => trip.id !== tripToDelete.id));
        setShowDeleteModal(false);
        setTripToDelete(null);
      } else {
        toast.error(result?.message || 'Error eliminando viaje');
      }
    } catch (error) {
      console.error('Error eliminando viaje:', error);
      toast.error('Error eliminando viaje');
    }
  };

  // Formatear duración en formato legible
  const formatDuration = (minutes) => {
    if (!minutes) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  // Formatear velocidad
  const formatSpeed = (speed) => {
    return speed ? `${speed.toFixed(1)} km/h` : '0 km/h';
  };

  // Cambiar página
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Cambiar ordenamiento
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  };

  // Obtener ícono de ordenamiento
  const getSortIcon = (column) => {
    if (sortBy !== column) return <i className="bi bi-arrow-down-up text-muted"></i>;
    return sortOrder === 'ASC' ? 
      <i className="bi bi-arrow-up text-primary"></i> : 
      <i className="bi bi-arrow-down text-primary"></i>;
  };

  if (loading && trips.length === 0) {
    return (
      <Container className="mt-4 text-center">
        <Spinner animation="border" variant="danger" />
        <p className="mt-2">Cargando historial de viajes...</p>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <Row className="mb-4">
        <Col>
          <h2>
            <i className="bi bi-clock-history text-danger me-2"></i>
            Historial de Viajes
          </h2>
          <p className="text-muted">
            Gestiona y revisa todos los viajes completados por los deliveries
          </p>
        </Col>
      </Row>

      {/* Controles de búsqueda y filtros */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Buscar por nombre o ID de empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={6} className="text-end">
          <Button variant="outline-primary" onClick={loadTripHistory} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>
            Actualizar
          </Button>
        </Col>
      </Row>

      {/* Estadísticas rápidas */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h4 className="text-primary">{filteredTrips.length}</h4>
              <small className="text-muted">Viajes Completados</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h4 className="text-success">
                {filteredTrips.reduce((acc, trip) => acc + (trip.mileage || 0), 0).toFixed(1)} km
              </h4>
              <small className="text-muted">Kilómetros Totales</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h4 className="text-info">
                {Math.round(filteredTrips.reduce((acc, trip) => acc + (trip.duration || 0), 0) / 60)} h
              </h4>
              <small className="text-muted">Horas Totales</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h4 className="text-warning">
                {filteredTrips.length > 0 ? 
                  (filteredTrips.reduce((acc, trip) => acc + (trip.averageSpeed || 0), 0) / filteredTrips.length).toFixed(1) 
                  : 0} km/h
              </h4>
              <small className="text-muted">Velocidad Promedio</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabla de historial */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">
            <i className="bi bi-list-ul me-2"></i>
            Viajes Completados ({filteredTrips.length})
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          {filteredTrips.length === 0 ? (
            <Alert variant="info" className="m-3">
              <i className="bi bi-info-circle me-2"></i>
              {searchTerm ? 'No se encontraron viajes que coincidan con la búsqueda.' : 'No hay viajes completados registrados.'}
            </Alert>
          ) : (
            <Table responsive hover className="mb-0">
              <thead className="table-dark">
                <tr>
                  <th 
                    className="cursor-pointer" 
                    onClick={() => handleSort('deliveryName')}
                  >
                    Delivery {getSortIcon('deliveryName')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('employeeId')}
                  >
                    ID {getSortIcon('employeeId')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('endTime')}
                  >
                    Fecha {getSortIcon('endTime')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('duration')}
                  >
                    Duración {getSortIcon('duration')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('mileage')}
                  >
                    Kilómetros {getSortIcon('mileage')}
                  </th>
                  <th 
                    className="cursor-pointer"
                    onClick={() => handleSort('averageSpeed')}
                  >
                    Vel. Promedio {getSortIcon('averageSpeed')}
                  </th>
                  <th>Ubicaciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td>
                      <strong>{trip.deliveryName}</strong>
                    </td>
                    <td>
                      <Badge bg="secondary">{trip.employeeId}</Badge>
                    </td>
                    <td>
                      <div>
                        <small className="text-muted">
                          {format(new Date(trip.endTime), 'dd/MM/yyyy', { locale: es })}
                        </small>
                        <br />
                        <small>
                          {format(new Date(trip.endTime), 'HH:mm', { locale: es })}
                        </small>
                      </div>
                    </td>
                    <td>
                      <Badge bg="info">
                        {formatDuration(trip.duration)}
                      </Badge>
                    </td>
                    <td>
                      <strong className="text-success">
                        {trip.mileage ? trip.mileage.toFixed(2) : '0.00'} km
                      </strong>
                    </td>
                    <td>
                      <span className="text-primary">
                        {formatSpeed(trip.averageSpeed)}
                      </span>
                    </td>
                    <td>
                      <Badge bg="light" text="dark">
                        {trip.totalLocations || 0} puntos
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Ver detalles del viaje</Tooltip>}
                        >
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              setSelectedTrip(trip);
                              setShowDetailModal(true);
                            }}
                          >
                            <i className="bi bi-eye"></i>
                          </Button>
                        </OverlayTrigger>
                        
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Eliminar viaje del historial</Tooltip>}
                        >
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => {
                              setTripToDelete(trip);
                              setShowDeleteModal(true);
                            }}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </OverlayTrigger>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
        
        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <Card.Footer>
            <div className="d-flex justify-content-between align-items-center">
              <small className="text-muted">
                Mostrando {filteredTrips.length} de {pagination.total} viajes
              </small>
              <Pagination className="mb-0">
                <Pagination.Prev 
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                />
                
                {[...Array(Math.min(5, pagination.totalPages))].map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === pagination.page}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                
                <Pagination.Next 
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                />
              </Pagination>
            </div>
          </Card.Footer>
        )}
      </Card>

      {/* Modal de detalles del viaje */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-info-circle text-primary me-2"></i>
            Detalles del Viaje
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTrip && (
            <Row>
              <Col md={6}>
                <Card className="h-100">
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-person me-2"></i>
                      Información del Delivery
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <p><strong>Nombre:</strong> {selectedTrip.deliveryName}</p>
                    <p><strong>ID Empleado:</strong> <Badge bg="secondary">{selectedTrip.employeeId}</Badge></p>
                    <p><strong>ID Viaje:</strong> <small className="text-muted">{selectedTrip.id}</small></p>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6}>
                <Card className="h-100">
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-clock me-2"></i>
                      Tiempo y Duración
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <p>
                      <strong>Inicio:</strong><br />
                      <small>{format(new Date(selectedTrip.startTime), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</small>
                    </p>
                    <p>
                      <strong>Fin:</strong><br />
                      <small>{format(new Date(selectedTrip.endTime), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</small>
                    </p>
                    <p>
                      <strong>Duración Total:</strong> 
                      <Badge bg="info" className="ms-2">{formatDuration(selectedTrip.duration)}</Badge>
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6} className="mt-3">
                <Card className="h-100">
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-speedometer2 me-2"></i>
                      Métricas de Recorrido
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <p>
                      <strong>Distancia:</strong> 
                      <span className="text-success ms-2 h5">{selectedTrip.mileage?.toFixed(2) || '0.00'} km</span>
                    </p>
                    <p>
                      <strong>Velocidad Promedio:</strong> 
                      <span className="text-primary ms-2">{formatSpeed(selectedTrip.averageSpeed)}</span>
                    </p>
                    <p>
                      <strong>Puntos GPS:</strong> 
                      <Badge bg="light" text="dark" className="ms-2">{selectedTrip.totalLocations || 0} ubicaciones</Badge>
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              
              <Col md={6} className="mt-3">
                <Card className="h-100">
                  <Card.Header>
                    <h6 className="mb-0">
                      <i className="bi bi-geo-alt me-2"></i>
                      Ubicaciones
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    {selectedTrip.startLocation && (
                      <p>
                        <strong>Punto de Inicio:</strong><br />
                        <small className="text-muted">
                          {selectedTrip.startLocation.latitude.toFixed(6)}, {selectedTrip.startLocation.longitude.toFixed(6)}
                        </small>
                      </p>
                    )}
                    {selectedTrip.endLocation && (
                      <p>
                        <strong>Punto Final:</strong><br />
                        <small className="text-muted">
                          {selectedTrip.endLocation.latitude.toFixed(6)}, {selectedTrip.endLocation.longitude.toFixed(6)}
                        </small>
                      </p>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Métricas en tiempo real si están disponibles */}
              {selectedTrip.realTimeMetrics && (
                <Col md={12} className="mt-3">
                  <Card>
                    <Card.Header>
                      <h6 className="mb-0">
                        <i className="bi bi-activity me-2"></i>
                        Métricas en Tiempo Real
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={3}>
                          <p>
                            <strong>Velocidad Máxima:</strong><br />
                            <span className="text-danger">
                              {selectedTrip.realTimeMetrics.maxSpeed || 0} km/h
                            </span>
                          </p>
                        </Col>
                        <Col md={3}>
                          <p>
                            <strong>Ubicaciones Válidas:</strong><br />
                            <span className="text-info">
                              {selectedTrip.realTimeMetrics.validLocations || 0}
                            </span>
                          </p>
                        </Col>
                        <Col md={6}>
                          <p>
                            <strong>Última Actualización:</strong><br />
                            <small className="text-muted">
                              {selectedTrip.realTimeMetrics.lastSpeedUpdate ? 
                                format(new Date(selectedTrip.realTimeMetrics.lastSpeedUpdate), 'dd/MM/yyyy HH:mm:ss', { locale: es })
                                : 'N/A'
                              }
                            </small>
                          </p>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              )}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de confirmación de eliminación */}
      <Modal 
        show={showDeleteModal} 
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle text-warning me-2"></i>
            Confirmar Eliminación
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tripToDelete && (
            <div>
              <p>¿Estás seguro que deseas eliminar este viaje del historial?</p>
              <Alert variant="warning">
                <strong>Delivery:</strong> {tripToDelete.deliveryName} ({tripToDelete.employeeId})<br />
                <strong>Fecha:</strong> {format(new Date(tripToDelete.endTime), 'dd/MM/yyyy HH:mm', { locale: es })}<br />
                <strong>Distancia:</strong> {tripToDelete.mileage?.toFixed(2) || '0.00'} km<br />
                <strong>Duración:</strong> {formatDuration(tripToDelete.duration)}
              </Alert>
              <p className="text-danger">
                <i className="bi bi-exclamation-circle me-1"></i>
                <strong>Esta acción no se puede deshacer.</strong>
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteTrip}>
            <i className="bi bi-trash me-1"></i>
            Eliminar Viaje
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx>{`
        .cursor-pointer {
          cursor: pointer;
          user-select: none;
        }
        .cursor-pointer:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </Container>
  );
};

export default TripHistory;
