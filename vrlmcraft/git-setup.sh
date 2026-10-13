#!/usr/bin/env bash
# Inicia o repositorio Git e envia para o GitHub (dispara o deploy no Render/Railway).
# Uso:
#   1) Crie um repositorio VAZIO no GitHub (sem README), copie a URL dele.
#   2) Rode:  bash git-setup.sh https://github.com/SEU_USUARIO/vrlmcraft-online.git
set -e

REPO_URL="$1"
if [ -z "$REPO_URL" ]; then
  echo "Uso: bash git-setup.sh <URL_DO_REPO_GITHUB>"
  echo "Ex.:  bash git-setup.sh https://github.com/seu-usuario/vrlmcraft-online.git"
  exit 1
fi

# Garante que node_modules e banco local nao irao para o repositorio
if [ ! -f .gitignore ]; then
  printf 'node_modules/\n.env\ndb/*.db\ndb/*.db.tmp\n' > .gitignore
fi

git init
git add .
git commit -m "VRLMCraft Online: jogo voxel multiplayer + servidor + deploy"
git branch -M main

# Se o remoto 'origin' ja existir, apenas atualiza a URL
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git push -u origin main
echo
echo "Pronto! Codigo enviado para: $REPO_URL"
echo "Agora no Render: New > Blueprint apontando para este repo (ele le o render.yaml)."
