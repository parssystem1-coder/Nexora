import type { ColumnType } from "kysely";

export interface CurrenciesTable {
  code: string;
  name: string;
  minor_units: number;
  // ADR-022 item 4: presentation configuration. Present in the row so it has
  // exactly one home, but never mapped onto the domain Currency entity.
  presentation_code: string | null;
  // bigint arrives from the pg driver as a string.
  presentation_divisor: string | null;
  presentation_symbol: string | null;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    currencies: CurrenciesTable;
  }
}
