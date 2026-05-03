import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SimulateAdvanceTimeDto } from './dto/simulate-advance-time.dto';
import { SimulateBulkTransactionsDto } from './dto/simulate-bulk-transactions.dto';
import { SimulateChangeDto } from './dto/simulate-change.dto';
import { SimulateProfileDto } from './dto/simulate-profile.dto';
import { SimulateTransactionDto } from './dto/simulate-transaction.dto';
import { SimulationService } from './simulation.service';

@Controller('simulate')
export class SimulationController {
  constructor(private readonly service: SimulationService) {}

  @Post('change')
  @HttpCode(HttpStatus.ACCEPTED)
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

  @Post('profile')
  simulateProfile(@Body() dto: SimulateProfileDto) {
    return this.service.updateProfile(dto);
  }

  @Post('advance-time')
  @HttpCode(HttpStatus.ACCEPTED)
  simulateAdvanceTime(@Body() dto: SimulateAdvanceTimeDto) {
    return this.service.advanceTime(dto);
  }

  @Post('bulk-transactions')
  @HttpCode(HttpStatus.ACCEPTED)
  simulateBulkTransactions(@Body() dto: SimulateBulkTransactionsDto) {
    return this.service.bulkTransactions(dto);
  }
}
