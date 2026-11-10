# 72-hour Cloudflare Access session

Derived from governance/STATE.md stage2.5.14, authorized2026-11-10 by the user's request to keep the existing login valid for72hours and complete closeout directly. This child records the bounded hosted-configuration change; STATE.md owns current authority and status.

## Applied change

Cloudflare Access application **Urban Tarot**, hostname **augurwell.anoriaquant.dev**: Session Duration changed from **24 hours** to **Custom duration:72h**. The dashboard displayed **Application successfully configured**; reopening the saved application showed **72h**. No application source change is needed.

The sole attached **Urban Tarot — trusted emails** Allow policy uses **Same as application session timeout**, has one email rule covering the existing two identities, and is used only by this application. Its rules and attachment were not edited. **Authenticate with Cloudflare One Client** is Off before/after. The hostname, identity-provider selection and policy order remain as observed. Other applications, organization-wide defaults and the certificate-validation exception were not changed. No session revocation, credential change, application-data write or provider call was performed.

## Semantics and evidence limits

The [official session-management documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/) inspected2026-11-10 states that application tokens remain valid for their lifecycle; a global session is consulted after the application/policy session expires. An inherited policy issues tokens using the application duration. This supports an app-scoped72h setting without changing the entire organization's session. **72h =259200seconds**.

Saved configuration was directly observed. A newly issued token's lifetime and72hours of elapsed browser persistence were not measured; existing issued tokens are not claimed to be extended retroactively. Preserve existing sessions and apply the duration to newly issued sessions. Clearing cookies, signing out or administrative revocation still ends the corresponding session.

Private, credential-free operation/preservation receipts are under .local/access-session-20261110/. Actual email addresses, session tokens and account configuration exports are excluded from tracked evidence. Rollback is the same application's Session Duration **24 hours**, retaining the same inherited policy and other settings.

## Closeout

Fresh pnpm check:all passed370 tests (15 access,132 reading,55 records,98 AI,70 randomness), governance, TypeScript, compiled runtime guards and build. The existing bundle-size advisory remains. At2026-11-10T08:54:20Z, canonical root/records/interpretations/random-status requests all redirect to Cloudflare login; the default Vercel origin rejects403 and the unique deployment requires Vercel login. The session change preserves anonymous exclusion.

All115 protected file hashes match, and the complete application tree is identical to bb5e06fe/released stage2.5.13. Independent read-only review found no blocker. Cloudflare configuration is live immediately after saving; no application release is needed for its effect. The closeout commit contains only documentation; final main push/automatic documentation-deployment identity and check receipts are retained in the private receipt folder. No paid provider request or subscription change is introduced.
