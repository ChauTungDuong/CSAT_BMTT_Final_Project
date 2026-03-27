import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CryptoLogService } from './services/crypto-log.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'crypto',
})
export class CryptoGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('CryptoGateway');

  constructor(private cryptoLogService: CryptoLogService) {
    this.cryptoLogService.getLogObservable().subscribe((group) => {
      this.server.emit('newGroup', group);
    });
  }

  afterInit(server: Server) {
    this.logger.log('Crypto monitoring WebSocket gateway initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    this.logger.log(`Monitor client connected: ${client.id}`);
    client.emit(
      'initialGroups',
      this.cryptoLogService.getGroups({ page: 1, limit: 10 }).items,
    );
  }

  handleDisconnect(client: any) {
    this.logger.log(`Monitor client disconnected: ${client.id}`);
  }
}
