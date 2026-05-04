import { ChangeType } from './events';

export interface SimulateTransactionDto {
  customerId: string;
  amount: number;
  occurredAt?: string;
}

export interface SimulateProfileDto {
  customerId: string;
  patch: Record<string, unknown>;
}

export interface SimulateAdvanceTimeDto {
  days: number;
}

export interface SimulateBulkTransactionsDto {
  count: number;
  minAmount?: number;
  maxAmount?: number;
  customerIds?: string[];
}

export interface SimulateChangeDto {
  customerId: string;
  changeType: ChangeType;
  fieldsChanged: string[];
  timestamp: string;
}

export interface SimulateTransactionResponse {
  transaction: {
    id: string;
    customerId: string;
    amount: string;
    occurredAt: string;
  };
  customer: {
    id: string;
    balance: string;
    txCount: number;
    lastTxAt: string | null;
  };
}

export interface SimulateAdvanceTimeResponse {
  days: number;
  transactionsShifted: number;
  customersAffected: number;
}

export interface SimulateBulkTransactionsResponse {
  inserted: number;
  customersAffected: number;
  chunks: number;
}
