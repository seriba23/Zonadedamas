import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class AppWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Track connected clients by tenantId
  private tenantSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    if (!tenantId) {
      client.disconnect();
      return;
    }

    // Join tenant room
    client.join(`tenant:${tenantId}`);

    // Track socket
    if (!this.tenantSockets.has(tenantId)) {
      this.tenantSockets.set(tenantId, new Set());
    }
    this.tenantSockets.get(tenantId)!.add(client.id);
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    if (tenantId && this.tenantSockets.has(tenantId)) {
      this.tenantSockets.get(tenantId)!.delete(client.id);
      if (this.tenantSockets.get(tenantId)!.size === 0) {
        this.tenantSockets.delete(tenantId);
      }
    }
  }

  // Listen for internal event and broadcast to tenant room
  @OnEvent('employee.joined')
  handleEmployeeJoined(payload: {
    tenantId: string;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      jobTitle: string | null;
      services: string[];
    };
  }) {
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('employee:joined', payload.employee);
  }

  @OnEvent('purchase.created')
  handlePurchaseCreated(payload: {
    tenantId: string;
    purchase: {
      id: string;
      customerName: string;
      customerEmail?: string | null;
      customerPhone: string;
      fulfillmentType: string;
      paymentMethod: string;
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
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('purchase:created', payload.purchase);
  }
}
