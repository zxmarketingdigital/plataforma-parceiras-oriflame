# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Desenvolvimento: código montado por volume, node_modules num volume próprio (binários Linux).
FROM base AS dev
CMD ["npm", "run", "dev"]

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# App de produção: saída standalone do Next.
FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/content ./content
COPY --from=build /app/config ./config
# O volume de dados herda o dono desta pasta: sem isto o utilizador node não grava os PDFs.
RUN mkdir -p /app/data/pdf && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# Worker e tarefas (migrar, seed, criar owner): código completo + tsx.
FROM deps AS worker
ENV NODE_ENV=production
COPY . .
RUN mkdir -p /app/data/pdf && chown -R node:node /app/data
USER node
CMD ["npm", "run", "worker"]
