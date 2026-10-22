import { next } from "@vercel/functions";
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { accessConfig } from "./config.js";

function privateResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export function createAccessGuard(getKey: JWTVerifyGetKey) {
  return async function guard(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname !== accessConfig.hostname) {
      return privateResponse("Please use the private application address.", 403);
    }

    // Vercel answers real certificate challenges before the app. Unknown challenge
    // paths must never fall through to Vite's single-page application fallback.
    if (url.pathname.startsWith("/.well-known/acme-challenge/")) {
      return privateResponse("Not found", 404);
    }

    const token = request.headers.get("cf-access-jwt-assertion");
    if (!token) return privateResponse("Sign in through Cloudflare Access.", 403);

    try {
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ["RS256"],
        issuer: accessConfig.issuer,
        audience: accessConfig.audience,
        requiredClaims: ["exp", "iat", "sub", "email"],
        clockTolerance: 5,
      });
      if (payload.type !== "app" || typeof payload.email !== "string" || !payload.email.trim()) {
        return privateResponse("Sign in through Cloudflare Access.", 403);
      }
      const response = next();
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch {
      // Signature, claims, and key-fetch failures all fail closed. Never log tokens.
      return privateResponse("Sign in through Cloudflare Access.", 403);
    }
  };
}
