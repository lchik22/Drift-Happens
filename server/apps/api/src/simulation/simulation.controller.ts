import { Body, Controller, Post } from '@nestjs/common';
import { SimulateChangeDto } from './dto/simulate-change.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';
import { SimulationService } from './simulation.service';

@Controller('simulate')
export class SimulationController {
  constructor(private readonly service: SimulationService) {}

  @Post('change')
  simulateChange(@Body() dto: SimulateChangeDto): { published: true } {
    this.service.publishCustomerChanged(dto);
    return { published: true };
  }

  @Post('transaction')
  async simulateTransaction(@Body() dto: SimulateTransactionDto) {
    const { transaction, customer } = await this.service.recordTransaction(dto);
    return {
      transaction: {
        id: transaction.id,
        customerId: transaction.customerId,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
      },
      customer: {
        id: customer.id,
        balance: customer.balance,
        txCount: customer.txCount,
        lastTxAt: customer.lastTxAt,
      },
    };
  }
}
