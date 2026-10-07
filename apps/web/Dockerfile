ARG NODE_IMAGE=node:24.20.0-alpine3.24

FROM ${NODE_IMAGE} AS build

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && corepack prepare pnpm@10.24.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8081
ARG NEXT_PUBLIC_KEYCLOAK_REALM=projet-indiv26
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=web

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_KEYCLOAK_URL=${NEXT_PUBLIC_KEYCLOAK_URL}
ENV NEXT_PUBLIC_KEYCLOAK_REALM=${NEXT_PUBLIC_KEYCLOAK_REALM}
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=${NEXT_PUBLIC_KEYCLOAK_CLIENT_ID}

RUN pnpm --filter web build \
  && pnpm --filter web deploy --prod --legacy /runtime/web \
  && cp -a apps/web/.next /runtime/web/.next \
  && cp -a apps/web/public /runtime/web/public

FROM ${NODE_IMAGE} AS runtime

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build --chown=node:node /runtime/web/ ./

USER node

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3001"]
