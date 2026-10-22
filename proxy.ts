import { createRemoteJWKSet } from "jose";
import { accessConfig } from "./access/config.js";
import { createAccessGuard } from "./access/guard.js";

const keys = createRemoteJWKSet(new URL(`${accessConfig.issuer}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000,
  cooldownDuration: 30000,
  cacheMaxAge: 3600000,
});

// Apply to every path, including scripts, images, and SPA routes, before caching.
export default createAccessGuard(keys);
