# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=25.6.1

############################
# base
############################
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Minimal OS deps (tini for proper signal handling)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     tini \
  && rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.29.3
RUN npm i -g "pnpm@${PNPM_VERSION}" \
  && pnpm --version

############################
# deps
############################
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile --ignore-scripts

############################
# build
############################
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY src ./src

RUN pnpm exec tsc -p tsconfig.json

RUN pnpm prune --prod --ignore-scripts

############################
# runtime
############################
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     tini \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER app

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini","--"]

CMD ["node","--enable-source-maps","dist/main.js"]
