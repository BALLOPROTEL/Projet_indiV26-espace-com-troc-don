ARG NODE_IMAGE=node:24.20.0-alpine3.24

FROM ${NODE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gateway/package.json apps/gateway/package.json

RUN pnpm install --frozen-lockfile

COPY apps/gateway apps/gateway

RUN pnpm --filter gateway build \
  && pnpm --filter gateway deploy --prod --legacy /runtime/gateway \
  && cp -a apps/gateway/dist /runtime/gateway/dist

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init \
  && addgroup -g 1000 -S app \
  && adduser -u 1000 -S -G app -h /home/app app

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build --chown=app:app /runtime/gateway/ ./

USER app

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
