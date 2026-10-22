import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { accessConfig } from "../access/config";
import { createAccessGuard } from "../access/guard";

let privateKey: CryptoKey;
let guard: ReturnType<typeof createAccessGuard>;
const now = Math.floor(Date.now() / 1000);
before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicKey = await exportJWK(pair.publicKey);
  guard = createAccessGuard(createLocalJWKSet({ keys: [{ ...publicKey, kid: "test-key", alg: "RS256" }] }));
});

async function sign(overrides: JWTPayload = {}) {
  return new SignJWT({
    iss: accessConfig.issuer, aud: accessConfig.audience, sub: "synthetic-user",
    email: "synthetic@example.test", type: "app", iat: now, exp: now + 3600,
    ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(privateKey);
}
function request(token?: string, path = "/", host = accessConfig.hostname as string) {
  return new Request(`https://${host}${path}`, {
    headers: token ? { "cf-access-jwt-assertion": token } : {},
  });
}

test("valid signed application token reaches the page and static assets", async () => {
  const token = await sign();
  for (const path of ["/", "/reading", "/assets/app.js", "/images/card.png"]) {
    const response = await guard(request(token, path));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
test("missing or malformed assertions cannot reach any app path", async () => {
  for (const path of ["/", "/assets/app.js", "/reading"]) {
    for (const token of [undefined, "fake", "eyJhbGciOiJub25lIn0.e30."]) {
      const response = await guard(request(token, path));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
});
for (const [name, claims] of Object.entries({
  "wrong issuer": { iss: "https://untrusted.example.test" },
  "other application's audience": { aud: "another-app" },
  "expired token": { exp: now - 60 },
  "not yet valid token": { nbf: now + 600 },
  "missing expiry": { exp: undefined },
  "missing subject": { sub: undefined },
  "missing identity": { email: undefined },
  "service token": { type: "service" },
})) {
  test(`rejects ${name}`, async () => {
    assert.equal((await guard(request(await sign(claims)))).status, 403);
  });
}
test("signature tampering is rejected", async () => {
  const token = await sign();
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url").toString()), sub: "forged" })).toString("base64url");
  assert.equal((await guard(request(parts.join(".")))).status, 403);
});
test("alternate deployment hostnames remain blocked even with a valid token", async () => {
  const token = await sign();
  assert.equal((await guard(request(token, "/", "my-urban-tarot-miniapp-light.vercel.app"))).status, 403);
});
test("identity headers or cookies alone are not authorization", async () => {
  const req = request();
  req.headers.set("cf-access-authenticated-user-email", "synthetic@example.test");
  req.headers.set("cookie", `CF_Authorization=${await sign()}`);
  assert.equal((await guard(req)).status, 403);
});
test("unavailable signing keys fail closed", async () => {
  const unavailable = createAccessGuard(async () => { throw new Error("unavailable"); });
  assert.equal((await unavailable(request(await sign()))).status, 403);
});
test("unknown certificate paths never expose the single-page application", async () => {
  const response = await guard(request(undefined, "/.well-known/acme-challenge/probe"));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not found");
});
