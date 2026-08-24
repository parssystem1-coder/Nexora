import { CapabilityError } from "../../capability/contracts/index.js";

export class WidgetAccessGuard {
  async canActivate(): Promise<boolean> {
    throw new CapabilityError("FORBIDDEN", "No access to this widget.");
  }
}
