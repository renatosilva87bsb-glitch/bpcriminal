

## Servir e publicar

O Preview e o container usam `server.mjs`, que entrega `public/` e roteia `/api/config`, `/api/leads`, `/api/ia`, `/api/contact-events`, `/api/push-subscribe` e `/api/push-send`. O `Dockerfile` instala a dependência de Web Push, respeita `PORT` e expõe a raiz como health check. O build continua produzindo `public/`, mas a publicação completa depende dos secrets server-side e do Supabase/Auth configurados no ambiente.
