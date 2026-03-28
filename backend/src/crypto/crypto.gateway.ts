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
import { ConfigService } from '@nestjs/config';

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

  constructor(
    private cryptoLogService: CryptoLogService,
    private config: ConfigService,
  ) {
    this.cryptoLogService.getLogObservable().subscribe((group) => {
      this.server.emit('newGroup', group);
    });
  }

  private isMonitorEnabled() {
    const enabled = this.config.get<string>('ENABLE_CRYPTO_MONITOR') === 'true';
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return enabled && !isProd;
  }

  afterInit(server: Server) {
    this.logger.log('Crypto monitoring WebSocket gateway initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    if (!this.isMonitorEnabled()) {
      this.logger.warn(
        `Rejected monitor connection in non-dev mode: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

    const expectedToken = this.config.get<string>('CRYPTO_MONITOR_TOKEN');
    const providedToken =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.['x-monitor-token'];

    if (expectedToken && providedToken !== expectedToken) {
      this.logger.warn(
        `Rejected monitor connection with invalid token: ${client.id}`,
      );
      client.disconnect(true);
      return;
    }

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
