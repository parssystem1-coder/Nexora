// VIOLATION FIXTURE (DEP-DIRECTION-CROSS-MODULE): module 'alpha' reaches into
// module 'beta' internals instead of importing modules/beta/contracts/.
import { BetaThing } from "../../beta/domain/beta-thing.entity.js";

export class DoThingService {
  run(): BetaThing {
    return new BetaThing();
  }
}
