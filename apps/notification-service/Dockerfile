ARG NODE_IMAGE=node:24.20.0-alpine3.24

FROM ${NODE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/notification-service/package.json apps/notification-service/package.json

RUN pnpm install --frozen-lockfile

COPY apps/notification-service apps/notification-service

RUN pnpm --filter notification-service build \
  && pnpm --filter notification-service deploy --prod --legacy /runtime/notification \
  && cp -a apps/notification-service/dist /runtime/notification/dist

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3103

WORKDIR /app

COPY --from=build --chown=node:node /runtime/notification/ ./

USER node

EXPOSE 3103

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
