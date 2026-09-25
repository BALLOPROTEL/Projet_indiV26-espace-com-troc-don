ARG NODE_IMAGE=node:24.20.0-alpine3.24
ARG ALPINE_IMAGE=alpine:3.24.1

FROM ${NODE_IMAGE} AS build

RUN apk add --no-cache openssl

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

RUN pnpm db:generate \
  && pnpm api:build \
  && pnpm --filter api deploy --prod --legacy /runtime/api \
  && GENERATED_PRISMA_CLIENT="$(find /workspace/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' -print -quit)" \
  && RUNTIME_PRISMA_PACKAGE="$(find /runtime/api/node_modules/.pnpm -type d -path '*/node_modules/@prisma/client' -print -quit)" \
  && test -n "${GENERATED_PRISMA_CLIENT}" \
  && test -n "${RUNTIME_PRISMA_PACKAGE}" \
  && RUNTIME_PACKAGE_NODE_MODULES="$(dirname "$(dirname "${RUNTIME_PRISMA_PACKAGE}")")" \
  && mkdir -p "${RUNTIME_PACKAGE_NODE_MODULES}/.prisma/client" \
  && cp -a "${GENERATED_PRISMA_CLIENT}/." "${RUNTIME_PACKAGE_NODE_MODULES}/.prisma/client/" \
  && test -f "${RUNTIME_PACKAGE_NODE_MODULES}/.prisma/client/default.js"

FROM ${ALPINE_IMAGE} AS runtime

RUN apk add --no-cache \
      ca-certificates \
      dumb-init \
      libstdc++ \
      openssl \
  && addgroup -g 1000 -S node \
  && adduser -u 1000 -S -G node -h /home/node node \
  && mkdir -p /app \
  && chown node:node /app

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build --chown=node:node /runtime/api/ ./

USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
