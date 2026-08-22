import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Money } from "../domain/money.vo.js";
import { Currency } from "../domain/currency.entity.js";
import { CurrencyMismatchError } from "../domain/money.errors.js";
import type { CurrencyRepository } from "../domain/currency.repository.js";
import { CurrencyRepositoryPg } from "../infrastructure/currency.repository.pg.js";

/**
 * ADR-022 item 7: money crosses an API boundary as a *string* amount plus a
 * currency code, never as a number, so no language-specific numeric parser
 * ever sees it:
 *
 *   { "amount": "1250000", "currency": "IRR", "minorUnits": 0 }
 *
 * `minorUnits` travels with the value so a consumer can place the decimal
 * point without hard-coding 2 for a currency that does not use it.
 */
export interface MoneyDto {
  amount: string;
  currency: string;
  minorUnits: number;
}

/**
 * The `currency` argument supplies the minor-unit exponent, which Money itself
 * does not carry — the exponent is registry data (ADR-022 item 3), and keeping
 * it out of the value object is what stops it being guessed at a call site.
 */
export function toMoneyDto(money: Money, currency: Currency): MoneyDto {
  if (money.currency !== currency.code) {
    throw new CurrencyMismatchError(money.currency, currency.code, "serialize");
  }
  return {
    amount: money.amountMinor.toString(),
    currency: money.currency,
    minorUnits: currency.minorUnits,
  };
}

export function fromMoneyDto(dto: MoneyDto, currency: Currency): Money {
  if (dto.currency !== currency.code) {
    throw new CurrencyMismatchError(dto.currency, currency.code, "deserialize");
  }
  if (dto.minorUnits !== currency.minorUnits) {
    throw new CurrencyMismatchError(dto.currency, currency.code, "deserialize with a mismatched minor-unit exponent for");
  }
  return Money.of(BigInt(dto.amount), dto.currency);
}

/**
 * Factory, mirroring modules/audit's createAuditEventRepository: lets another
 * module bind the repository to a connection it already holds without
 * importing this module's concrete PG class, which
 * DEP-DIRECTION-CROSS-MODULE forbids.
 */
export function createCurrencyRepository(conn: Kysely<Database> | Transaction<Database>): CurrencyRepository {
  return new CurrencyRepositoryPg(conn);
}
