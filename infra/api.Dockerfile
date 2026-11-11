# syntax=docker/dockerfile:1.7
# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspaces --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @hrms/shared && npm run build -w @hrms/api \
 && npm prune --omit=dev --workspaces --include-workspace-root

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini && addgroup -S hrms && adduser -S hrms -G hrms
COPY --from=build --chown=hrms:hrms /app/node_modules ./node_modules
COPY --from=build --chown=hrms:hrms /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=hrms:hrms /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=hrms:hrms /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=hrms:hrms /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=hrms:hrms /app/apps/api/drizzle ./apps/api/drizzle
RUN mkdir -p /data/storage && chown hrms:hrms /data/storage
USER hrms
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/main.js"]
