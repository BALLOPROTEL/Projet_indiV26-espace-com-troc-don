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
COPY apps/marketplace-service/package.json apps/marketplace-service/package.json

RUN pnpm install --frozen-lockfile

COPY apps/marketplace-service apps/marketplace-service

RUN pnpm --filter marketplace-service build \
  && pnpm --filter marketplace-service deploy --prod --legacy /runtime/marketplace \
  && cp -a apps/marketplace-service/dist /runtime/marketplace/dist \
  && mkdir -p /runtime/marketplace/generated \
  && cp -a apps/marketplace-service/generated/prisma /runtime/marketplace/generated/prisma

FROM build AS migration

ENV NODE_ENV=production
ENV COREPACK_ENABLE_NETWORK=0

USER node

CMD ["pnpm", "--filter", "marketplace-service", "prisma:migrate:deploy"]

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=3102

WORKDIR /app

COPY --from=build --chown=node:node /runtime/marketplace/ ./

USER node

EXPOSE 3102

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
