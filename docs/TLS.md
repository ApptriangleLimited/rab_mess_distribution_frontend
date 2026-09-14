# Production TLS

Do not generate fake production certificates. Terminate TLS on nginx, Caddy, or a cloud load balancer with a real certificate (Let's Encrypt or org PKI).

## Recommended path

1. Keep Compose services on the private Docker network. Publish only the proxy (`80`/`443`).
2. Obtain certificates outside this repo (`certbot`, ACME, or the load balancer).
3. Place `fullchain.pem` and `privkey.pem` in `TLS_CERT_DIR` (for example `/etc/letsencrypt/live/<hostname>`).
4. On the server set `NGINX_CONFIG=nginx.tls.conf`. The production overlay mounts that file and publishes `80`/`443`.
5. `deploy/nginx/nginx.tls.conf` returns `301` from HTTP to HTTPS. Do not use a self-signed certificate and call this complete.
6. Set:

```text
CORS_ORIGINS=https://app.example.com
PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_API_URL=https://app.example.com
ENABLE_HSTS=true
```

`ENABLE_HSTS` stays false until HTTPS is verified. Turning it on too early can pin browsers to a broken HTTPS origin.

## Verify

- `http://` redirects to `https://`
- Frontend and `/api/` load over HTTPS
- Access tokens stay in `localStorage` (Bearer). Session cookie is role/name only; CSRF is documented in `docs/API.md`
- `X-Forwarded-Proto` and `X-Real-IP` reach the API
- Uploads up to `client_max_body_size` (12m) succeed
- `/health/live` and `/health/ready` succeed through the proxy

Auth uses `Authorization: Bearer` headers, not credential-bearing JWT cookies. Browser CSRF against cookie sessions does not apply to the API. The `mess_session` cookie is a UI hint only.
