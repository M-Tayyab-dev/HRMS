# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspaces --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @hrms/shared && npm run build -w @hrms/web

FROM node:22-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apk add --no-cache tini && addgroup -S hrms && adduser -S hrms -G hrms
COPY --from=build --chown=hrms:hrms /app /app
USER hrms
WORKDIR /app/apps/web
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "next", "start", "--port", "3000"]
