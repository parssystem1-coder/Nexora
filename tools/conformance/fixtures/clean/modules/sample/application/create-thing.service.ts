// @singleton-role: money-allocator
import { Thing } from "../domain/thing.entity.js";
import type { ThingSummary } from "../contracts/sample.contract.js";

export class CreateThingService {
  execute(id: string, name: string): ThingSummary {
    const thing = new Thing(id, name);
    return { id: thing.id, name: thing.name };
  }
}
