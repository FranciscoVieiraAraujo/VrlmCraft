# Imagem para rodar o VRLMCraft Online em qualquer host com Docker (Fly.io, Railway, VPS)
FROM node:18-alpine

WORKDIR /app

# Instala dependencias primeiro (cache de camada)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copia o restante do projeto
COPY . .

# O banco (arquivo unico) vive num volume persistente montado em /data
ENV DB_FILE=/data/vrlmcraft.db
ENV PORT=15800
VOLUME ["/data"]

EXPOSE 15800
CMD ["npm", "start"]
