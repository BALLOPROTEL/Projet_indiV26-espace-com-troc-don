ARG NODE_IMAGE=node:24.20.0-alpine3.24

FROM ${NODE_IMAGE} AS build

RUN apk add --no-cache openssl

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

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

CMD ["pnpm", "--filter", "catalog-service", "prisma:migrate:deploy"]

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init openssl \
  && addgroup -g 1000 -S app \
  && adduser -u 1000 -S -G app -h /home/app app

ENV NODE_ENV=production
ENV PORT=3101

WORKDIR /app

COPY --from=build --chown=app:app /runtime/catalog/ ./

USER app

EXPOSE 3101

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
