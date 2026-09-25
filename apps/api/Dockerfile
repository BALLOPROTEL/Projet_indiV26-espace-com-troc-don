ARG NODE_IMAGE=node:24.20.0-alpine3.24

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
  && pnpm --filter api deploy --prod /runtime/api

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /runtime/api/ ./

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
