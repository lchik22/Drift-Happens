export interface Customer {
  id: string;
  email: string | null;
  name: string | null;
  balance: string;
  txCount: number;
  lastTxAt: string | null;
  profile: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
