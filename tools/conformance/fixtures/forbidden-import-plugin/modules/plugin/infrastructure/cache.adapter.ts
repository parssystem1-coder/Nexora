// VIOLATION FIXTURE (FORBIDDEN-IMPORT-PLUGIN): plugin boundary must never import Redis directly.
import Redis from "ioredis";

export class CacheAdapter {
  constructor(private readonly redis: Redis) {}
}
