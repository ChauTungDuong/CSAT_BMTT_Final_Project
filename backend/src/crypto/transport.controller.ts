import { Controller, Get } from '@nestjs/common';
import { RsaTransportService } from './services/rsa-transport.service';

@Controller('transport')
export class TransportController {
  constructor(private readonly rsaTransport: RsaTransportService) {}

  @Get('public-key')
  getPublicKey() {
    return this.rsaTransport.getPublicKeyMeta();
  }
}
