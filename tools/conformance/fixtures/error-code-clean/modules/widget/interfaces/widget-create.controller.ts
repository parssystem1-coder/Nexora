import { widgetCreateCapability } from "./widget-create.capability.js";
import { WidgetAccessGuard } from "./widget-access.guard.js";

export class WidgetCreateController {
  guard = new WidgetAccessGuard();
  capability = widgetCreateCapability;
}
