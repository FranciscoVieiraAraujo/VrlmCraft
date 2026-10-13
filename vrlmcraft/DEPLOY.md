# Guia de Deploy - VRLMCraft Online

O jogo precisa de um host que (1) mantenha o servidor Node LIGADO (por causa do
WebSocket do multiplayer e do chat de voz) e (2) tenha DISCO PERSISTENTE (o banco e
o arquivo `db/vrlmcraft.db`). Abaixo, o passo a passo para cada opcao.

> IMPORTANTE: Vercel e Netlify NAO servem para este projeto (sao serverless, nao
> mantem WebSocket ligado nem disco persistente; o banco seria apagado). Use Render,
> Railway, Fly.io ou um VPS.

---

## Opcao A - Render.com (mais simples, recomendado)

1. Suba o projeto para um repositorio no GitHub.
2. No Render: **New > Blueprint** e aponte para o repositorio.
   O Render le o arquivo `render.yaml` e ja configura tudo (build, start, disco e o
   segredo `SESSION_SECRET` aleatorio).
3. Confirme que existe um **Disk** montado em `/var/data` (ja esta no `render.yaml`).
4. Deploy. A URL publica (ja com HTTPS) sera algo como `https://vrlmcraft-online.onrender.com`.

> O plano gratis do Render NAO oferece disco persistente. Para o banco nao se perder,
> use o plano **Starter** (com disco) OU troque para um banco externo (ver secao final).

---

## Opcao B - Railway.app

1. Suba o projeto para o GitHub.
2. No Railway: **New Project > Deploy from GitHub repo**. Ele usa o `Dockerfile`
   (configurado em `railway.json`).
3. Em **Variables**, defina:
   - `DB_FILE = /data/vrlmcraft.db`
   - `SESSION_SECRET = <uma chave aleatoria longa>`
   - (opcional) `EVENT_HOUR=19`, `EVENT_MINUTE=30`, `EVENT_DURATION_MIN=60`
4. Em **Settings > Volumes**, crie um volume e monte em **`/data`**.
5. Deploy. Pegue a URL publica em **Settings > Networking > Generate Domain**.

---

## Opcao C - Fly.io

Com o Fly CLI instalado e logado:
```bash
fly launch --no-deploy          # usa o fly.toml incluido; recuse bancos gerenciados
fly volumes create vrlmdata --size 1 --region gru   # gru = Sao Paulo
fly secrets set SESSION_SECRET=$(openssl rand -hex 24)
fly deploy
```
A URL sera `https://vrlmcraft-online.fly.dev`.

---

## Opcao D - VPS proprio (ou sua maquina com o AMPPS)

1. Instale Node.js 18+ e, de preferencia, Nginx (ou Caddy) para o HTTPS.
2. Envie os arquivos e rode:
   ```bash
   npm install
   cp .env.example .env     # edite PORT, SESSION_SECRET, DB_FILE
   npm start
   ```
3. Para manter rodando sempre, use **systemd** (modelo abaixo) ou PM2 (`npm i -g pm2 && pm2 start server.js`).
4. Coloque um proxy reverso com HTTPS na frente (o microfone/WebSocket exigem HTTPS).

### systemd (`/etc/systemd/system/vrlmcraft.service`)
```ini
[Unit]
Description=VRLMCraft Online
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/vrlmcraft
ExecStart=/usr/bin/node server.js
Environment=PORT=15800
Environment=DB_FILE=/opt/vrlmcraft/db/vrlmcraft.db
Environment=SESSION_SECRET=TROQUE_POR_ALGO_ALEATORIO
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now vrlmcraft
```

### Nginx (proxy com WebSocket)
```nginx
server {
  server_name seu-dominio.com;
  location / {
    proxy_pass http://127.0.0.1:15800;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";   # necessario para o WebSocket /ws
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```
Depois gere o HTTPS gratis com `certbot --nginx`.

---

## Verificando o deploy

- Acesse `https://SEU-DOMINIO/api/health` -> deve responder `{"ok":true,...}`.
- Crie uma conta, salve um mundo, saia e entre de novo: o mundo deve continuar la
  (prova de que o disco persistente/banco esta funcionando para todos).

## Backup do banco

E so copiar o arquivo apontado por `DB_FILE` (ex.: `/var/data/vrlmcraft.db`).
Para restaurar, basta colocar o arquivo de volta no mesmo caminho.

## (Opcional) Banco externo central

Se quiser um banco gerenciado (ex.: MySQL do AMPPS, Postgres do Supabase) em vez do
arquivo local, a troca fica isolada em `src/db.js` (funcoes `run/get/all`). Da para
reimplementar as tres com o driver desejado sem mexer no resto do codigo.
