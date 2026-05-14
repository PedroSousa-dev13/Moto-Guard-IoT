import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "MotoGuard IoT — API",
      version: "1.0.0",
      description: "API do sistema de telemetria para motociclos MotoGuard.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Desenvolvimento" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description: "JWT armazenado em cookie httpOnly (automático após login)",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        LoginBody: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
        RegisterBody: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
            name: { type: "string" },
          },
        },
        Motorcycle: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            brand: { type: "string" },
            model: { type: "string" },
            year: { type: "integer" },
            plate: { type: "string" },
            category: { type: "string" },
            deviceId: { type: "string" },
          },
        },
        Trip: {
          type: "object",
          properties: {
            id: { type: "string" },
            startedAt: { type: "string", format: "date-time" },
            endedAt: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["ACTIVE", "COMPLETED", "CANCELLED"] },
            source: { type: "string", enum: ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] },
            distanceKm: { type: "number" },
            avgSpeedKmh: { type: "number" },
            maxSpeedKmh: { type: "number" },
          },
        },
        Telemetry: {
          type: "object",
          properties: {
            deviceId: { type: "string" },
            speed: { type: "number" },
            rpm: { type: "number" },
            temperature: { type: "number" },
            battery: { type: "number" },
            latitude: { type: "number" },
            longitude: { type: "number" },
          },
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Estado do servidor",
          responses: {
            "200": {
              description: "Health check com estado dos serviços",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      service: { type: "string" },
                      timestamp: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          tags: ["Autenticação"],
          summary: "Registar novo utilizador",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } } },
          },
          responses: {
            "201": { description: "Conta criada com sucesso" },
            "400": { description: "Dados inválidos" },
            "409": { description: "Email já registado" },
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Autenticação"],
          summary: "Iniciar sessão",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } } },
          },
          responses: {
            "200": { description: "Login bem-sucedido (cookie + JSON)" },
            "401": { description: "Credenciais inválidas" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Autenticação"],
          summary: "Perfil do utilizador autenticado",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Dados do utilizador" },
          },
        },
      },
      "/api/auth/profile": {
        put: {
          tags: ["Autenticação"],
          summary: "Atualizar perfil",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, emergencyContact: { type: "string" } } } } },
          },
          responses: { "200": { description: "Perfil atualizado" } },
        },
      },
      "/api/auth/change-password": {
        put: {
          tags: ["Autenticação"],
          summary: "Alterar palavra-passe",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { currentPassword: { type: "string" }, newPassword: { type: "string", minLength: 6 } } } } },
          },
          responses: { "200": { description: "Password alterada" } },
        },
      },
      "/api/auth/forgot-password": {
        post: {
          tags: ["Autenticação"],
          summary: "Pedido de recuperação de senha",
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } },
          },
          responses: { "200": { description: "Email enviado (se configurado)" } },
        },
      },
      "/api/auth/reset-password": {
        post: {
          tags: ["Autenticação"],
          summary: "Redefinir senha com token",
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" }, newPassword: { type: "string" } } } } },
          },
          responses: { "200": { description: "Senha redefinida" } },
        },
      },
      "/api/telemetry/latest": {
        get: {
          tags: ["Telemetria"],
          summary: "Última leitura de telemetria em memória",
          security: [{ cookieAuth: [] }],
          responses: {
            "200": { description: "Última telemetria recebida via MQTT" },
            "204": { description: "Sem dados ainda" },
          },
        },
      },
      "/api/telemetry/{tripId}": {
        get: {
          tags: ["Telemetria"],
          summary: "Telemetria histórica de uma viagem (InfluxDB)",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "tripId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Pontos de telemetria da viagem" },
            "404": { description: "Viagem não encontrada" },
          },
        },
      },
      "/api/trips": {
        get: {
          tags: ["Viagens"],
          summary: "Listar viagens do utilizador",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "source", in: "query", schema: { type: "string", enum: ["SIMULATOR", "GPX_IMPORTED", "DEVICE_REAL"] } },
            { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "COMPLETED", "CANCELLED"] } },
          ],
          responses: { "200": { description: "Lista de viagens" } },
        },
      },
      "/api/trips/feed": {
        get: {
          tags: ["Viagens"],
          summary: "Feed de viagens com scores",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "source", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Feed de viagens com safety/performance scores" } },
        },
      },
      "/api/trips/{id}": {
        get: {
          tags: ["Viagens"],
          summary: "Detalhe de uma viagem",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Detalhes da viagem com eventos" },
            "404": { description: "Viagem não encontrada" },
          },
        },
      },
      "/api/trips/{id}/evaluation": {
        get: {
          tags: ["Viagens"],
          summary: "Avaliação ML de uma viagem",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Resultado da avaliação ML" } },
        },
      },
      "/api/trips/{id}/categorize": {
        post: {
          tags: ["Viagens"],
          summary: "Recategorizar uma viagem",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Categoria e confiança" } },
        },
      },
      "/api/alerts": {
        get: {
          tags: ["Alertas"],
          summary: "Listar alertas do utilizador",
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: "severity", in: "query", schema: { type: "string", enum: ["INFO", "WARNING", "CRITICAL"] } },
            { name: "type", in: "query", schema: { type: "string" } },
            { name: "tripId", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
          ],
          responses: { "200": { description: "Lista de eventos/alerta" } },
        },
      },
      "/api/motorcycles": {
        get: {
          tags: ["Motorcycles"],
          summary: "Listar motas do utilizador",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Lista de motas com perfis" } },
        },
        post: {
          tags: ["Motorcycles"],
          summary: "Adicionar nova mota",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", required: ["name", "category"], properties: { name: { type: "string" }, brand: { type: "string" }, model: { type: "string" }, year: { type: "integer" }, plate: { type: "string" }, category: { type: "string" }, profileId: { type: "string" }, deviceId: { type: "string" } } } } },
          },
          responses: {
            "201": { description: "Mota criada" },
            "400": { description: "Dados inválidos" },
          },
        },
      },
      "/api/motorcycles/{id}": {
        put: {
          tags: ["Motorcycles"],
          summary: "Atualizar dados de uma mota",
          security: [{ cookieAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Mota atualizada" } },
        },
        delete: {
          tags: ["Motorcycles"],
          summary: "Remover mota",
          security: [{ cookieAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Mota removida" } },
        },
      },
      "/api/motorcycle-profiles": {
        get: {
          tags: ["Motorcycles"],
          summary: "Listar perfis de mota disponíveis",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Lista de perfis" } },
        },
      },
      "/api/command": {
        post: {
          tags: ["Comandos"],
          summary: "Enviar comando ao simulador via MQTT",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", required: ["acao"], properties: { acao: { type: "string", example: "parar" } } } } },
          },
          responses: {
            "200": { description: "Comando enviado" },
            "503": { description: "MQTT offline" },
          },
        },
      },
      "/api/gpx/import": {
        post: {
          tags: ["GPX"],
          summary: "Importar ficheiro GPX como viagem",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, motorcycleId: { type: "string" } } } } },
          },
          responses: { "201": { description: "Viagem criada a partir do GPX" } },
        },
      },
      "/api/gpx/parse": {
        post: {
          tags: ["GPX"],
          summary: "Analisar ficheiro GPX (sem criar viagem)",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
          },
          responses: { "200": { description: "Dados parseados do GPX" } },
        },
      },
      "/api/gpx/simulator": {
        post: {
          tags: ["GPX"],
          summary: "Guardar dados GPX do simulador",
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: { "application/json": { schema: { type: "object", properties: { tripId: { type: "string" }, waypoints: { type: "array", items: { type: "object" } } } } } },
          },
          responses: { "201": { description: "Dados GPX guardados" } },
        },
      },
      "/api/gpx/export/{tripId}": {
        get: {
          tags: ["GPX"],
          summary: "Exportar viagem como ficheiro GPX",
          security: [{ cookieAuth: [] }],
          parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Ficheiro GPX" } },
        },
      },
      "/api/ml/status": {
        get: {
          tags: ["ML"],
          summary: "Estado do pipeline de ML",
          security: [{ cookieAuth: [] }],
          responses: { "200": { description: "Status do modelo ML" } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
