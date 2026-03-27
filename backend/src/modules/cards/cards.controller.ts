import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { CardsService } from './cards.service';
import { CreateCardDto, RevealCardDto } from './dto/card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CardsController {
  constructor(private readonly service: CardsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  createCard(@Body() dto: CreateCardDto, @Req() req: any) {
    return this.service.createCard(req.user.sub, dto, req.ip);
  }

  @Get('me')
  @Roles(Role.CUSTOMER)
  getMyCards(@Req() req: any) {
    return this.service.getMyCards(req.user.sub, req.ip);
  }

  @Post(':id/reveal')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  revealCard(
    @Param('id') id: string,
    @Body() dto: RevealCardDto,
    @Req() req: any,
  ) {
    return this.service.revealCard(req.user.sub, id, dto.pin, req.ip);
  }
}
