FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @edupath/api --include-workspace-root

COPY apps/api apps/api
RUN npm run db:generate --workspace @edupath/api \
 && npm run build --workspace @edupath/api

FROM build AS migrator
ENV NODE_ENV=production
ENTRYPOINT ["npm", "run", "db:migrate:deploy", "--workspace", "@edupath/api"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
