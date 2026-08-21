// VIOLATION FIXTURE (DEP-DIRECTION-DOMAIN): a domain file must never import application/.
import { CreateThingService } from "../application/create-thing.service.js";

export class Thing {
  constructor(private readonly service: CreateThingService) {}
}
