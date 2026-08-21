// VIOLATION FIXTURE (FORBIDDEN-IMPORT-REPOSITORY): ai/mcp/automation/storefront
// modules must never import a repository directly, only an application service via contracts/.
import type { OrderRepository } from "../../commerce/domain/order.repository.js";

export class SummarizeOrderService {
  constructor(private readonly orders: OrderRepository) {}
}
