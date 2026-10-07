FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Directorio de sesiones — se monta como volumen en Fly.io
RUN mkdir -p /data/sessions

ENV SESSIONS_DIR=/data/sessions
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/server.js"]
