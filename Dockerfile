FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/apps/web/dist ./apps/web/dist
COPY --from=builder /usr/src/app/apps/miniapp/dist ./apps/miniapp/dist
COPY index.js main.js migrate.js ./
COPY migrations ./migrations
EXPOSE 3000
CMD ["node", "index.js"]
