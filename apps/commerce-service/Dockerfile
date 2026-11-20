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
COPY apps/commerce-service/package.json apps/commerce-service/package.json

RUN pnpm install --frozen-lockfile

COPY apps/commerce-service apps/commerce-service

RUN pnpm --filter commerce-service build \
  && pnpm --filter commerce-service deploy --prod --legacy /runtime/commerce \
  && cp -a apps/commerce-service/dist /runtime/commerce/dist \
  && mkdir -p /runtime/commerce/generated \
  && cp -a apps/commerce-service/generated/prisma /runtime/commerce/generated/prisma

FROM build AS migration

ENV NODE_ENV=production
ENV COREPACK_ENABLE_NETWORK=0

USER node

CMD ["pnpm", "--filter", "commerce-service", "prisma:migrate:deploy"]

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production
ENV PORT=3104

WORKDIR /app

COPY --from=build --chown=node:node /runtime/commerce/ ./

USER node

EXPOSE 3104

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
