import swaggerJSDoc from 'swagger-jsdoc';

const response = (description, schema, examples = {}) => ({
  description,
  content: {
    'application/json': {
      schema,
      ...(Object.keys(examples).length ? { examples } : {}),
    },
  },
});

const successResponse = (description = 'Successful response', data = {}) =>
  response(description, {
    allOf: [
      { $ref: '#/components/schemas/SuccessResponse' },
      { type: 'object', properties: { data: { type: 'object', properties: data } } },
    ],
  });

const collectionResponse = (property, itemRef) => successResponse('Successful response', {
  [property]: { type: 'array', items: { $ref: itemRef } },
});

const errorResponses = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
};

const protectedOperation = (operation) => ({
  security: [{ bearerAuth: [] }],
  ...operation,
});

const idParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
});

const jsonRequest = (schema, description = 'JSON request body') => ({
  required: true,
  description,
  content: { 'application/json': { schema } },
});

const openApiDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Hospital OPD Queuing and Bed Availability API',
    version: '1.0.0',
    description: 'OpenAPI documentation for the Hospital OPD Queuing and Bed Availability Tracker backend.',
  },
  servers: [{ url: 'http://localhost:5000', description: 'Local development server' }],
  tags: [
    { name: 'Health', description: 'Service health' },
    { name: 'Authentication', description: 'Registration, login, and current-user profile' },
    { name: 'Departments', description: 'Department management' },
    { name: 'Doctors', description: 'Doctor directory and administration' },
    { name: 'Queue', description: 'Patient OPD tokens and appointment history' },
    { name: 'Doctor Queue', description: 'Doctor queue operations' },
    { name: 'Beds and Wards', description: 'Ward, bed, and availability management' },
    { name: 'Notifications', description: 'User notifications' },
    { name: 'Admin', description: 'Administrative reporting and user management' },
  ],
  paths: {
    '/api/health': {
      get: { tags: ['Health'], summary: 'Health check', operationId: 'healthCheck', responses: { 200: response('Server is healthy', { $ref: '#/components/schemas/HealthResponse' }) } },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'], summary: 'Register a patient', operationId: 'registerPatient',
        requestBody: jsonRequest({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: { 201: successResponse('Registration successful', { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } }), 400: errorResponses[400], 409: { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'], summary: 'Log in any user role', operationId: 'login',
        requestBody: jsonRequest({ $ref: '#/components/schemas/LoginRequest' }),
        responses: { 200: successResponse('Login successful', { token: { type: 'string' }, user: { $ref: '#/components/schemas/User' } }), 400: errorResponses[400], 401: errorResponses[401] },
      },
    },
    '/api/auth/me': {
      get: protectedOperation({ tags: ['Authentication'], summary: 'Get current user', operationId: 'getCurrentUser', responses: { 200: successResponse('Current user fetched', { user: { $ref: '#/components/schemas/UserProfile' } }), 401: errorResponses[401] } }),
    },
    '/api/departments': {
      get: protectedOperation({ tags: ['Departments'], summary: 'List departments', operationId: 'listDepartments', parameters: [{ name: 'includeInactive', in: 'query', schema: { type: 'boolean' }, description: 'Admins may include inactive departments.' }], responses: { 200: collectionResponse('departments', '#/components/schemas/Department'), 401: errorResponses[401] } }),
      post: protectedOperation({ tags: ['Departments'], summary: 'Create department (admin)', operationId: 'createDepartment', requestBody: jsonRequest({ $ref: '#/components/schemas/DepartmentRequest' }), responses: { 201: successResponse('Department created', { department: { $ref: '#/components/schemas/Department' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409] } }),
    },
    '/api/departments/{id}': {
      parameters: [idParam('id', 'Department MongoDB ID')],
      get: protectedOperation({ tags: ['Departments'], summary: 'Get department', operationId: 'getDepartment', responses: { 200: successResponse('Department fetched', { department: { $ref: '#/components/schemas/Department' } }), 400: errorResponses[400], 401: errorResponses[401], 404: errorResponses[404] } }),
      patch: protectedOperation({ tags: ['Departments'], summary: 'Update department (admin)', operationId: 'updateDepartment', requestBody: jsonRequest({ $ref: '#/components/schemas/DepartmentUpdateRequest' }), responses: { 200: successResponse('Department updated', { department: { $ref: '#/components/schemas/Department' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
      delete: protectedOperation({ tags: ['Departments'], summary: 'Deactivate department (admin)', operationId: 'deactivateDepartment', responses: { 200: successResponse('Department deactivated', { department: { $ref: '#/components/schemas/Department' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/doctors': {
      get: protectedOperation({ tags: ['Doctors'], summary: 'List doctors', operationId: 'listDoctors', parameters: [{ name: 'department', in: 'query', schema: { type: 'string' } }, { name: 'available', in: 'query', schema: { type: 'boolean' } }], responses: { 200: collectionResponse('doctors', '#/components/schemas/Doctor'), 400: errorResponses[400], 401: errorResponses[401] } }),
      post: protectedOperation({ tags: ['Doctors'], summary: 'Create doctor (admin)', operationId: 'createDoctor', requestBody: jsonRequest({ $ref: '#/components/schemas/CreateDoctorRequest' }), responses: { 201: successResponse('Doctor created', { doctor: { $ref: '#/components/schemas/Doctor' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409] } }),
    },
    '/api/doctors/{id}': {
      parameters: [idParam('id', 'Doctor profile MongoDB ID')],
      get: protectedOperation({ tags: ['Doctors'], summary: 'Get doctor', operationId: 'getDoctor', responses: { 200: successResponse('Doctor fetched', { doctor: { $ref: '#/components/schemas/Doctor' } }), 400: errorResponses[400], 401: errorResponses[401], 404: errorResponses[404] } }),
      patch: protectedOperation({ tags: ['Doctors'], summary: 'Update doctor (admin)', operationId: 'updateDoctor', requestBody: jsonRequest({ $ref: '#/components/schemas/DoctorUpdateRequest' }), responses: { 200: successResponse('Doctor updated', { doctor: { $ref: '#/components/schemas/Doctor' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/doctors/profile/me': { $ref: '#/paths/~1api~1doctor~1profile~1me' },
    '/api/doctors/queue': { $ref: '#/paths/~1api~1doctor~1queue' },
    '/api/doctors/stats': { $ref: '#/paths/~1api~1doctor~1stats' },
    '/api/doctors/call-next': { $ref: '#/paths/~1api~1doctor~1call-next' },
    '/api/doctors/{tokenId}/complete': { $ref: '#/paths/~1api~1doctor~1{tokenId}~1complete' },
    '/api/doctors/{tokenId}/skip': { $ref: '#/paths/~1api~1doctor~1{tokenId}~1skip' },
    '/api/doctor': { $ref: '#/paths/~1api~1doctors' },
    '/api/doctor/{id}': { $ref: '#/paths/~1api~1doctors~1{id}' },
    '/api/doctor/profile/me': {
      get: protectedOperation({ tags: ['Doctors'], summary: 'Get logged-in doctor profile', operationId: 'getMyDoctorProfile', description: 'Requires a DOCTOR role.', responses: { 200: successResponse('Doctor profile fetched', { doctor: { $ref: '#/components/schemas/Doctor' } }), 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/doctor/queue': {
      get: protectedOperation({ tags: ['Doctor Queue'], summary: "Get doctor's queue", operationId: 'getDoctorQueue', description: 'Requires a DOCTOR role.', responses: { 200: successResponse("Today's doctor queue fetched", { queue: { type: 'array', items: { $ref: '#/components/schemas/QueueToken' } } }), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/doctor/stats': {
      get: protectedOperation({ tags: ['Doctor Queue'], summary: "Get doctor's daily stats", operationId: 'getDoctorStats', description: 'Requires a DOCTOR role.', responses: { 200: successResponse("Today's doctor stats fetched", { waiting: { type: 'integer' }, serving: { type: 'integer' }, completed: { type: 'integer' }, skipped: { type: 'integer' } }), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/doctor/call-next': {
      post: protectedOperation({ tags: ['Doctor Queue'], summary: 'Call next patient', operationId: 'callNextPatient', description: 'Requires a DOCTOR role.', responses: { 200: successResponse('Next patient called', { token: { $ref: '#/components/schemas/QueueToken' } }), 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/doctor/{tokenId}/complete': {
      parameters: [idParam('tokenId', 'Queue token MongoDB ID')],
      post: protectedOperation({ tags: ['Doctor Queue'], summary: 'Complete a queue token', operationId: 'completeToken', description: 'Requires a DOCTOR role.', responses: { 200: successResponse('Token completed'), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/doctor/{tokenId}/skip': {
      parameters: [idParam('tokenId', 'Queue token MongoDB ID')],
      post: protectedOperation({ tags: ['Doctor Queue'], summary: 'Skip a queue token', operationId: 'skipToken', description: 'Requires a DOCTOR role.', responses: { 200: successResponse('Token skipped'), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/queue/book': {
      post: protectedOperation({ tags: ['Queue'], summary: 'Book an OPD token', operationId: 'bookToken', description: 'Requires a PATIENT role.', requestBody: jsonRequest({ $ref: '#/components/schemas/BookTokenRequest' }), responses: { 201: successResponse('OPD token booked', { token: { $ref: '#/components/schemas/QueueToken' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409] } }),
    },
    '/api/queue/my-token': {
      get: protectedOperation({ tags: ['Queue'], summary: 'Get active patient token', operationId: 'getMyToken', description: 'Requires a PATIENT role.', responses: { 200: successResponse('Active token fetched', { token: { $ref: '#/components/schemas/QueueToken' } }), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/queue/history': {
      get: protectedOperation({ tags: ['Queue'], summary: 'Get appointment history', operationId: 'getAppointmentHistory', description: 'Requires a PATIENT role.', responses: { 200: successResponse('Appointment history fetched', { appointments: { type: 'array', items: { $ref: '#/components/schemas/Appointment' } } }), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/queue/cancel/{tokenId}': {
      parameters: [idParam('tokenId', 'Queue token MongoDB ID')],
      post: protectedOperation({ tags: ['Queue'], summary: 'Cancel patient token', operationId: 'cancelToken', description: 'Requires a PATIENT role and ownership of the token.', responses: { 200: successResponse('Token cancelled'), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/queue/{tokenId}/status': {
      parameters: [idParam('tokenId', 'Queue token MongoDB ID')],
      get: protectedOperation({ tags: ['Queue'], summary: 'Get token status', operationId: 'getTokenStatus', responses: { 200: successResponse('Token status fetched', { currentServingToken: { type: 'integer', nullable: true }, yourToken: { type: 'integer' }, peopleAhead: { type: 'integer' }, estimatedWaitTime: { type: 'integer' }, status: { $ref: '#/components/schemas/TokenStatus' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/queue/{departmentId}': {
      parameters: [idParam('departmentId', 'Department MongoDB ID')],
      get: protectedOperation({ tags: ['Queue'], summary: 'Get department queue', operationId: 'getDepartmentQueue', responses: { 200: successResponse("Today's department queue fetched", { department: { type: 'string' }, queue: { type: 'array', items: { $ref: '#/components/schemas/QueueBoardItem' } } }), 400: errorResponses[400], 401: errorResponses[401], 404: errorResponses[404] } }),
    },
    '/api/beds/wards': {
      get: protectedOperation({ tags: ['Beds and Wards'], summary: 'List active wards', operationId: 'listWards', responses: { 200: collectionResponse('wards', '#/components/schemas/Ward'), 401: errorResponses[401] } }),
      post: protectedOperation({ tags: ['Beds and Wards'], summary: 'Create ward (admin)', operationId: 'createWard', requestBody: jsonRequest({ $ref: '#/components/schemas/WardRequest' }), responses: { 201: successResponse('Ward created', { ward: { $ref: '#/components/schemas/Ward' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 409: errorResponses[409] } }),
    },
    '/api/beds/availability': {
      get: protectedOperation({ tags: ['Beds and Wards'], summary: 'Get bed availability by ward', operationId: 'getBedAvailability', responses: { 200: successResponse('Bed availability fetched'), 401: errorResponses[401] } }),
    },
    '/api/beds': {
      get: protectedOperation({ tags: ['Beds and Wards'], summary: 'List beds', operationId: 'listBeds', parameters: [{ name: 'ward', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/BedStatus' } }], responses: { 200: collectionResponse('beds', '#/components/schemas/Bed'), 400: errorResponses[400], 401: errorResponses[401] } }),
      post: protectedOperation({ tags: ['Beds and Wards'], summary: 'Create bed (admin)', operationId: 'createBed', requestBody: jsonRequest({ $ref: '#/components/schemas/BedRequest' }), responses: { 201: successResponse('Bed created', { bed: { $ref: '#/components/schemas/Bed' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404], 409: errorResponses[409] } }),
    },
    '/api/beds/{id}': {
      parameters: [idParam('id', 'Bed MongoDB ID')],
      get: protectedOperation({ tags: ['Beds and Wards'], summary: 'Get bed', operationId: 'getBed', responses: { 200: successResponse('Bed fetched', { bed: { $ref: '#/components/schemas/Bed' } }), 400: errorResponses[400], 401: errorResponses[401], 404: errorResponses[404] } }),
    },
    '/api/beds/{id}/status': {
      parameters: [idParam('id', 'Bed MongoDB ID')],
      patch: protectedOperation({ tags: ['Beds and Wards'], summary: 'Update bed status (admin)', operationId: 'updateBedStatus', requestBody: jsonRequest({ $ref: '#/components/schemas/BedStatusRequest' }), responses: { 200: successResponse('Bed status updated', { bed: { $ref: '#/components/schemas/Bed' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/notifications': {
      get: protectedOperation({ tags: ['Notifications'], summary: 'List current user notifications', operationId: 'listNotifications', parameters: [{ name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } }], responses: { 200: successResponse('Notifications fetched', { notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } }, unreadCount: { type: 'integer' } }), 401: errorResponses[401] } }),
    },
    '/api/notifications/read-all': {
      patch: protectedOperation({ tags: ['Notifications'], summary: 'Mark all notifications as read', operationId: 'markAllNotificationsRead', responses: { 200: successResponse('All notifications marked as read'), 401: errorResponses[401] } }),
    },
    '/api/notifications/{id}/read': {
      parameters: [idParam('id', 'Notification MongoDB ID')],
      patch: protectedOperation({ tags: ['Notifications'], summary: 'Mark notification as read', operationId: 'markNotificationRead', responses: { 200: successResponse('Notification marked as read', { notification: { $ref: '#/components/schemas/Notification' } }), 400: errorResponses[400], 401: errorResponses[401], 404: errorResponses[404] } }),
    },
    '/api/admin/dashboard': {
      get: protectedOperation({ tags: ['Admin'], summary: 'Get dashboard analytics', operationId: 'getAdminDashboard', description: 'Requires an ADMIN role.', responses: { 200: successResponse('Dashboard data fetched'), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/admin/appointments': {
      get: protectedOperation({ tags: ['Admin'], summary: 'List all appointments', operationId: 'listAdminAppointments', description: 'Requires an ADMIN role.', parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'department', in: 'query', schema: { type: 'string' } }, { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: successResponse('Appointments fetched', { appointments: { type: 'array', items: { $ref: '#/components/schemas/Appointment' } } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/admin/queues': {
      get: protectedOperation({ tags: ['Admin'], summary: 'List all queues', operationId: 'listAdminQueues', description: 'Requires an ADMIN role.', responses: { 200: successResponse("Today's queues fetched"), 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/admin/users': {
      get: protectedOperation({ tags: ['Admin'], summary: 'List users', operationId: 'listAdminUsers', description: 'Requires an ADMIN role.', parameters: [{ name: 'role', in: 'query', schema: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] } }], responses: { 200: collectionResponse('users', '#/components/schemas/User'), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403] } }),
    },
    '/api/admin/users/{id}': {
      parameters: [idParam('id', 'User MongoDB ID')],
      get: protectedOperation({ tags: ['Admin'], summary: 'Get user', operationId: 'getAdminUser', description: 'Requires an ADMIN role.', responses: { 200: successResponse('User fetched', { user: { $ref: '#/components/schemas/User' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
    '/api/admin/users/{id}/status': {
      parameters: [idParam('id', 'User MongoDB ID')],
      patch: protectedOperation({ tags: ['Admin'], summary: 'Activate or deactivate user', operationId: 'updateUserStatus', description: 'Requires an ADMIN role. An admin cannot change their own status.', requestBody: jsonRequest({ $ref: '#/components/schemas/UserStatusRequest' }), responses: { 200: successResponse('User status updated', { user: { $ref: '#/components/schemas/User' } }), 400: errorResponses[400], 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] } }),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter a JWT as: Bearer <token>' },
    },
    responses: {
      BadRequest: response('Bad request or validation failure', { $ref: '#/components/schemas/ErrorResponse' }),
      Unauthorized: response('Authentication required or invalid', { $ref: '#/components/schemas/ErrorResponse' }),
      Forbidden: response('Authenticated user lacks the required role', { $ref: '#/components/schemas/ErrorResponse' }),
      NotFound: response('Resource not found', { $ref: '#/components/schemas/ErrorResponse' }),
      Conflict: response('Resource conflict', { $ref: '#/components/schemas/ErrorResponse' }),
    },
    schemas: {
      SuccessResponse: { type: 'object', required: ['success', 'message'], properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: { type: 'object', nullable: true } } },
      HealthResponse: { type: 'object', required: ['success', 'message'], properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'Server is healthy' } } },
      ErrorResponse: { type: 'object', required: ['success', 'message'], properties: { success: { type: 'boolean', example: false }, message: { type: 'string' }, error: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] } } },
      User: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'] }, isActive: { type: 'boolean' } } },
      UserProfile: { allOf: [{ $ref: '#/components/schemas/User' }, { type: 'object', properties: { age: { type: 'integer' }, gender: { type: 'string', enum: ['Male', 'Female', 'Other'] } } }] },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      RegisterRequest: { type: 'object', required: ['name', 'email', 'password', 'phone'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6, format: 'password' }, phone: { type: 'string', pattern: '^[0-9]{10}$' }, age: { type: 'integer', minimum: 0, maximum: 150 }, gender: { type: 'string', enum: ['Male', 'Female', 'Other'] } } },
      Department: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, isActive: { type: 'boolean' } } },
      DepartmentRequest: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } },
      DepartmentUpdateRequest: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, isActive: { type: 'boolean' } } },
      Doctor: { type: 'object', properties: { _id: { type: 'string' }, user: { $ref: '#/components/schemas/User' }, department: { $ref: '#/components/schemas/Department' }, specialization: { type: 'string' }, licenseNumber: { type: 'string' }, experience: { type: 'integer' }, consultationRoom: { type: 'string' }, averageConsultationTime: { type: 'integer' }, isAvailable: { type: 'boolean' } } },
      CreateDoctorRequest: { type: 'object', required: ['name', 'email', 'password', 'phone', 'department', 'specialization', 'licenseNumber'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6, format: 'password' }, phone: { type: 'string', pattern: '^[0-9]{10}$' }, age: { type: 'integer' }, gender: { type: 'string', enum: ['Male', 'Female', 'Other'] }, department: { type: 'string' }, specialization: { type: 'string' }, licenseNumber: { type: 'string' }, experience: { type: 'integer', minimum: 0 }, consultationRoom: { type: 'string' }, averageConsultationTime: { type: 'integer', minimum: 1 } } },
      DoctorUpdateRequest: { type: 'object', properties: { department: { type: 'string' }, specialization: { type: 'string' }, experience: { type: 'integer', minimum: 0 }, consultationRoom: { type: 'string' }, isAvailable: { type: 'boolean' }, averageConsultationTime: { type: 'integer', minimum: 1 } } },
      BookTokenRequest: { type: 'object', required: ['doctorId'], properties: { doctorId: { type: 'string', description: 'Doctor profile MongoDB ID' } } },
      TokenStatus: { type: 'string', enum: ['WAITING', 'SERVING', 'COMPLETED', 'SKIPPED', 'CANCELLED'] },
      QueueToken: { type: 'object', properties: { id: { type: 'string' }, _id: { type: 'string' }, tokenNumber: { type: 'integer' }, department: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/Department' }] }, doctor: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/Doctor' }] }, status: { $ref: '#/components/schemas/TokenStatus' }, peopleAhead: { type: 'integer' }, estimatedWaitTime: { type: 'integer' } } },
      QueueBoardItem: { type: 'object', properties: { tokenNumber: { type: 'integer' }, doctor: { type: 'string' }, status: { $ref: '#/components/schemas/TokenStatus' } } },
      Appointment: { type: 'object', properties: { _id: { type: 'string' }, patient: { $ref: '#/components/schemas/User' }, doctor: { $ref: '#/components/schemas/Doctor' }, department: { $ref: '#/components/schemas/Department' }, appointmentDate: { type: 'string', format: 'date-time' }, status: { type: 'string' }, queueToken: { $ref: '#/components/schemas/QueueToken' } } },
      Ward: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string', enum: ['GENERAL', 'ICU', 'EMERGENCY', 'PRIVATE', 'SEMI_PRIVATE'] }, totalBeds: { type: 'integer' }, isActive: { type: 'boolean' } } },
      WardRequest: { type: 'object', required: ['name', 'type'], properties: { name: { type: 'string' }, type: { type: 'string', enum: ['GENERAL', 'ICU', 'EMERGENCY', 'PRIVATE', 'SEMI_PRIVATE'] }, totalBeds: { type: 'integer', minimum: 0 } } },
      BedStatus: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] },
      Bed: { type: 'object', properties: { _id: { type: 'string' }, bedNumber: { type: 'string' }, ward: { $ref: '#/components/schemas/Ward' }, status: { $ref: '#/components/schemas/BedStatus' }, patient: { $ref: '#/components/schemas/User' }, admittedAt: { type: 'string', format: 'date-time', nullable: true }, releasedAt: { type: 'string', format: 'date-time', nullable: true } } },
      BedRequest: { type: 'object', required: ['bedNumber', 'ward'], properties: { bedNumber: { type: 'string' }, ward: { type: 'string', description: 'Ward MongoDB ID' } } },
      BedStatusRequest: { type: 'object', required: ['status'], properties: { status: { $ref: '#/components/schemas/BedStatus' }, patient: { type: 'string', description: 'Required when status is OCCUPIED' } } },
      Notification: { type: 'object', properties: { _id: { type: 'string' }, title: { type: 'string' }, message: { type: 'string' }, type: { type: 'string' }, isRead: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } },
      UserStatusRequest: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: openApiDefinition,
  apis: [],
});

export default swaggerSpec;
