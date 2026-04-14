import { Controller, Get } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Public()
  @Get()
  async getRates() {
    const data = await this.exchangeRatesService.getRates();
    return { data };
  }
}
