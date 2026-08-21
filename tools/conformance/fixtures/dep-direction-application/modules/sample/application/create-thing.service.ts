// VIOLATION FIXTURE (DEP-DIRECTION-APPLICATION): application must not import infrastructure.
import { ThingRepositoryPg } from "../infrastructure/thing.repository.pg.js";

export class CreateThingService {
  constructor(private readonly repo: ThingRepositoryPg) {}
}
