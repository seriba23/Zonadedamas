// ─────────────────────────────────────────────────────────────────────────────
// CONCEPTO: ¿Qué es un WebSocket?
// Una petición HTTP normal es de "ida y vuelta": el cliente pregunta y el
// servidor responde, y la conexión se cierra. Un WebSocket, en cambio, es un
// "canal abierto y permanente" entre cliente y servidor: cualquiera de los dos
// puede ENVIAR mensajes al otro en cualquier momento, sin volver a preguntar.
// Por eso sirve para "tiempo real" (avisar al instante de una nueva compra,
// una cita, etc.). socket.io es la librería que implementa esto.
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores/interfaces de NestJS para WebSockets:
//   - WebSocketGateway: marca la clase como "gateway" (manejador de sockets).
//   - WebSocketServer: inyecta el servidor de socket.io en una propiedad.
//   - OnGatewayConnection / OnGatewayDisconnect: interfaces de ciclo de vida.
//     Si la clase las implementa, NestJS llama a handleConnection /
//     handleDisconnect cuando un cliente se conecta o se desconecta.
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
// Tipos de socket.io:
//   - Server: el servidor de sockets completo (puede emitir a todos).
//   - Socket: la conexión de UN cliente concreto.
import { Server, Socket } from 'socket.io';
// OnEvent: igual que en los listeners; suscribe un método a un evento interno
// de la app. Aquí lo usamos para "reenviar" eventos del backend a los clientes
// conectados por WebSocket.
import { OnEvent } from '@nestjs/event-emitter';

// @WebSocketGateway configura el servidor de sockets:
//   - cors: { origin: '*' } => permite conexiones desde CUALQUIER origen/dominio
//     (CORS = control de qué webs pueden conectarse). El "*" = todas.
//   - namespace: '/' => el "espacio de nombres" raíz (un namespace es como un
//     canal separado dentro del mismo servidor; aquí usamos el principal).
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class AppWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // @WebSocketServer() inyecta automáticamente la instancia del servidor
  // socket.io en esta propiedad "server", para poder emitir mensajes desde
  // cualquier método.
  @WebSocketServer()
  server: Server;

  // Track connected clients by tenantId
  // Mapa en memoria que recuerda qué sockets (conexiones) hay por cada negocio.
  // La CLAVE es el tenantId (texto) y el VALOR es un Set con los ids de socket
  // conectados de ese tenant. Un Set evita ids duplicados.
  private tenantSockets = new Map<string, Set<string>>();

  // ───────────────────────────────────────────────────────────────────────────
  // handleConnection(): NestJS lo llama cada vez que un cliente ABRE una
  // conexión WebSocket. "client" es la conexión de ese cliente.
  // ───────────────────────────────────────────────────────────────────────────
  handleConnection(client: Socket) {
    // El cliente envía su tenantId en la "query" del handshake (los parámetros
    // que manda al conectarse, parecido a ?tenantId=... en una URL).
    // "as string" le dice a TypeScript que lo trate como texto.
    const tenantId = client.handshake.query.tenantId as string;
    // Si no envió tenantId, no sabemos a qué negocio pertenece: lo desconectamos
    // y salimos.
    if (!tenantId) {
      client.disconnect();
      return;
    }

    // Join tenant room
    // Una "room" (sala) en socket.io es un grupo de sockets al que se puede
    // emitir en bloque. Metemos a este cliente en la sala de su tenant, así
    // luego podremos avisar SOLO a los clientes de ese negocio.
    client.join(`tenant:${tenantId}`);

    // Track socket
    // Si todavía no había ningún socket de este tenant, creamos su Set vacío.
    if (!this.tenantSockets.has(tenantId)) {
      this.tenantSockets.set(tenantId, new Set());
    }
    // Añadimos el id de este socket al Set del tenant. El "!" (non-null
    // assertion) le promete a TypeScript que .get(tenantId) no es undefined
    // (acabamos de garantizar que existe arriba).
    this.tenantSockets.get(tenantId)!.add(client.id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // handleDisconnect(): NestJS lo llama cuando un cliente CIERRA su conexión.
  // Limpiamos el registro para no dejar ids "fantasma".
  // ───────────────────────────────────────────────────────────────────────────
  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    // Solo si tenía tenantId y lo teníamos registrado.
    if (tenantId && this.tenantSockets.has(tenantId)) {
      // Quitamos este socket del Set del tenant.
      this.tenantSockets.get(tenantId)!.delete(client.id);
      // Si ese tenant ya no tiene ningún socket conectado (.size === 0),
      // borramos su entrada del mapa para liberar memoria.
      if (this.tenantSockets.get(tenantId)!.size === 0) {
        this.tenantSockets.delete(tenantId);
      }
    }
  }

  // Listen for internal event and broadcast to tenant room
  // ───────────────────────────────────────────────────────────────────────────
  // handleEmployeeJoined(): escucha el evento interno 'employee.joined' (cuando
  // se da de alta un empleado) y lo "retransmite" en tiempo real a los clientes
  // del tenant para que su pantalla se actualice al instante.
  // ───────────────────────────────────────────────────────────────────────────
  @OnEvent('employee.joined')
  handleEmployeeJoined(payload: {
    tenantId: string;
    // Describimos la forma del empleado que viaja en el evento.
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      jobTitle: string | null; // puede no tener puesto (null)
      services: string[];      // ids/nombres de servicios que ofrece
    };
  }) {
    // .to(sala) selecciona la sala del tenant; .emit(nombreEvento, datos) envía
    // el mensaje SOLO a los sockets de esa sala. El frontend escucha el evento
    // 'employee:joined' y reacciona.
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('employee:joined', payload.employee);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // handlePurchaseCreated(): escucha 'purchase.created' (nueva compra en la
  // tienda) y avisa en tiempo real a los clientes del tenant. (Nota: el mismo
  // evento también lo escucha staff-events.listener para crear la notificación
  // persistente; aquí solo es el "aviso instantáneo" en pantalla.)
  // ───────────────────────────────────────────────────────────────────────────
  @OnEvent('purchase.created')
  handlePurchaseCreated(payload: {
    tenantId: string;
    purchase: {
      id: string;
      customerName: string;
      customerEmail?: string | null; // opcional y puede ser null
      customerPhone: string;
      fulfillmentType: string; // cómo se entrega (recoger, envío...)
      paymentMethod: string;
      // "Array<{...}>" = lista de objetos; cada uno es un producto comprado.
      items: Array<{
        productId: string;
        productName: string;
        productImage: string | null;
        quantity: number;
        unitPrice: number;
      }>;
      total: number;
      createdAt: Date;
    };
  }) {
    // Emitimos el evento 'purchase:created' con los datos de la compra a la sala
    // del tenant, para que la interfaz muestre la venta al momento.
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('purchase:created', payload.purchase);
  }
}
