// Module: decorador que agrupa los componentes de este módulo.
import { Module } from '@nestjs/common';
// El "gateway": la clase que maneja las conexiones de tiempo real (socket.io).
import { AppWebSocketGateway } from './websocket.gateway';

// Módulo que registra el gateway de WebSocket. Un gateway es como un
// "controlador" pero para conexiones en tiempo real en vez de peticiones HTTP.
@Module({
  providers: [AppWebSocketGateway], // el gateway vive dentro de este módulo
  exports: [AppWebSocketGateway],   // lo compartimos por si otro módulo lo necesita
})
export class WebSocketModule {}
