# VRLMCraft Online

[![CI](https://github.com/SEU_USUARIO/vrlmcraft-online/actions/workflows/ci.yml/badge.svg)](https://github.com/SEU_USUARIO/vrlmcraft-online/actions/workflows/ci.yml)
[![Deploy](https://github.com/SEU_USUARIO/vrlmcraft-online/actions/workflows/deploy.yml/badge.svg)](https://github.com/SEU_USUARIO/vrlmcraft-online/actions/workflows/deploy.yml)

> Troque `SEU_USUARIO` nas linhas acima pelo seu usuario do GitHub (e, se usar outro
> nome de repositorio, troque `vrlmcraft-online` tambem) para os badges aparecerem.

Jogo voxel multiplayer no navegador (Three.js) com servidor Node.js + banco de dados.
Inclui: personagens com ferramentas, inimigos, tunel ate o centro da Terra com larvas de
lava, dia/noite pelo horario LOCAL do jogador, banco de mundos salvos, cenarios padrao
gerados por um "diretor" procedural (IA), evento diario as 19:30 com presentes e musica
animada, e chat de voz (WebRTC).

## Como rodar (local, no seu PC)

```bash
npm install
cp .env.example .env      # (opcional) ajuste porta/segredo/horario do evento
npm start
```
Abra: http://127.0.0.1:15800

> Precisa de Node.js 16 ou maior. O banco e um arquivo unico (`db/vrlmcraft.db`,
> SQLite via sql.js, 100% JavaScript, sem compilador). Para preservar os dados,
> basta **levar esse arquivo junto** no deploy ou fazer backup dele.

## O banco "vai junto" no deploy?

Sim. Como o banco e um unico arquivo (`db/vrlmcraft.db`), ele funciona em qualquer
host que tenha **disco persistente**. O servidor recria o esquema automaticamente
se o arquivo nao existir, entao no primeiro deploy ja funciona para todos os jogadores.

## Onde hospedar para o banco funcionar para TODOS os jogadores

Voce precisa de um host que mantenha o servidor Node LIGADO e o disco persistente
(por causa do WebSocket do multiplayer/voz e do arquivo do banco):

| Host | Serve? | Observacao |
|------|--------|-----------|
| **Render.com** (Web Service + Disk) | SIM (recomendado) | Adicione um "Disk" montado em `/opt/render/project/src/db` e aponte `DB_FILE` para la. Suporta WebSocket. |
| **Railway.app** | SIM | Adicione um Volume e aponte `DB_FILE` para o volume. |
| **Fly.io** | SIM | Use um Volume persistente. |
| **VPS** (Contabo, DigitalOcean, Oracle Free, sua maquina com AMPPS) | SIM | Rode `npm start` atras de um Nginx/Caddy com HTTPS. |
| **Vercel / Netlify** | NAO para este projeto | Sao serverless: nao mantem WebSocket ligado nem disco persistente. O banco seria apagado. Use um dos de cima. |

Dicas de deploy:
- Defina a variavel `DB_FILE` apontando para a pasta do disco persistente.
- O host costuma injetar a porta pela variavel `PORT` (o servidor ja respeita isso).
- Rode atras de HTTPS. O chat de voz (microfone) e o WebSocket exigem HTTPS em dominio publico.
- Troque `SESSION_SECRET` por um valor aleatorio.

### Trocar para MySQL/PostgreSQL (opcional)
Se um dia quiser um banco central maior (ex.: AMPPS MySQL ou Supabase), toda a troca
fica isolada em `src/db.js` (funcoes `run/get/all`). Da para reimplementar essas tres
funcoes para o driver desejado sem mexer no resto.

## Modos de jogo

1. **Solo** - offline, so voce (usa os presentes que ganhou no evento).
2. **Local 2 jogadores** - mesmo PC/tela. Jogador 1 = mouse + WASD/setas; Jogador 2 = I J K L.
3. **Online** - varios jogadores no mesmo cenario (sala global), com chat de texto.
4. **Convite (P2P + voz)** - crie um codigo e compartilhe; quem entrar com o mesmo codigo
   cai na sua sala. Ative o microfone para chat de VOZ (WebRTC P2P entre navegadores).

## Controles

- **Mouse** = olhar · **WASD** ou **setas ↑↓←→** = andar
- **Espaco** = pular · **Shift** = correr
- **Botao esquerdo** = quebrar · **Botao direito** = colocar bloco
- **T** = tocha (ilumina casa/tunel) · **F** = cavar tunel para o centro da Terra
- **1-7** = trocar item · **M** = salvar o mundo · **Enter** = chat

## Dia e noite

O ceu, o sol e a iluminacao seguem o **relogio local** do dispositivo de quem joga
(fuso horario detectado automaticamente). De dia fica claro; ao entardecer o ceu fica
laranja; a noite escurece e as tochas fazem diferenca.

## Evento diario 19:30

Todo dia as 19:30 (hora do servidor, configuravel no `.env`) abre um evento de 1 hora:
varios jogadores no mesmo cenario, presentes espalhados, musica animada. Um jogador pode
pegar o presente que outro coletou. Ao terminar, cada um volta para sua propria conta e
da continuidade no seu mundo (ou clica em sair). Os presentes ganhos ficam guardados e
podem ser usados jogando sozinho depois.

## Diretor de cenarios (IA procedural)

O servidor acompanha, de forma anonima e agregada, como as pessoas jogam (o que quebram,
cavam, constroem) e gera novos **cenarios padrao** variando parametros de bioma/estruturas
com ruido e mutacao, para que nunca fique robotico. Esses cenarios ficam salvos no banco e
ficam disponiveis para todos os jogadores escolherem no menu.

## Seguranca

- Senhas guardadas com hash **bcrypt** (nunca em texto puro).
- Sessoes por token com validade.
- As rotas que mexem em dados do usuario exigem autenticacao.
- Lembre de rodar atras de HTTPS em producao e trocar o `SESSION_SECRET`.
