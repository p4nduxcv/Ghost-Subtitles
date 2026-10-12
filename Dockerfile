# syntax=docker/dockerfile:1

# ---- Build: install everything, run tests, build the React app ----
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm test && npm run build

# ---- Runtime: server dependencies + built client only ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY server/src server/src
COPY --from=build /app/client/dist client/dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "server/src/index.js"]
