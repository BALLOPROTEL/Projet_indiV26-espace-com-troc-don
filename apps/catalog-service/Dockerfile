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
COPY apps/catalog-service/package.json apps/catalog-service/package.json

RUN pnpm install --frozen-lockfile

COPY apps/catalog-service apps/catalog-service

RUN pnpm --filter catalog-service build \
  && pnpm --filter catalog-service deploy --prod --legacy /runtime/catalog \
  && cp -a apps/catalog-service/dist /runtime/catalog/dist \
  && mkdir -p /runtime/catalog/generated \
  && cp -a apps/catalog-service/generated/prisma /runtime/catalog/generated/prisma

FROM build AS migration

ENV NODE_ENV=production
ENV COREPACK_ENABLE_NETWORK=0

USER node

CMD ["pnpm", "--filter", "catalog-service", "prisma:migrate:deploy"]

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=3101

WORKDIR /app

COPY --from=build --chown=node:node /runtime/catalog/ ./

USER node

EXPOSE 3101

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
