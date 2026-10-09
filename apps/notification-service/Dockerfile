ARG NODE_IMAGE=node:24.20.0-alpine3.24

FROM ${NODE_IMAGE} AS build
RUN apk add --no-cache openssl
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV COREPACK_HOME=/opt/corepack

RUN mkdir -p "${COREPACK_HOME}" \
  && corepack enable \
  && corepack prepare pnpm@10.24.0 --activate \
  && chmod -R a+rX "${COREPACK_HOME}"

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/notification-service/package.json apps/notification-service/package.json
RUN pnpm install --frozen-lockfile
COPY apps/notification-service apps/notification-service

RUN pnpm --filter notification-service build \
  && pnpm --filter notification-service deploy --prod --legacy /runtime/notification \
  && cp -a apps/notification-service/dist /runtime/notification/dist \
  && mkdir -p /runtime/notification/generated \
  && cp -a apps/notification-service/generated/prisma /runtime/notification/generated/prisma

FROM build AS migration
ENV NODE_ENV=production
ENV COREPACK_ENABLE_NETWORK=0
USER node
CMD ["pnpm", "--filter", "notification-service", "prisma:migrate:deploy"]

FROM ${NODE_IMAGE} AS runtime
RUN apk add --no-cache dumb-init openssl
ENV NODE_ENV=production
ENV PORT=3103
WORKDIR /app
COPY --from=build --chown=node:node /runtime/notification/ ./
USER node
EXPOSE 3103
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
