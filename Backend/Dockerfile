FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY Frontend/package.json Frontend/package.json
COPY Backend/package.json Backend/package.json
RUN npm ci

COPY Backend/tsconfig.json Backend/tsconfig.json
COPY Backend/src Backend/src
RUN npm run build --workspace backend
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/Backend/dist Backend/dist
COPY Backend/config Backend/config
RUN mkdir -p /app/data && chown -R node:node /app/data

WORKDIR /app/Backend
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
