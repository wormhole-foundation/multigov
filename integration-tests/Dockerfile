FROM ghcr.io/foundry-rs/foundry:latest as foundry

COPY . ./app
WORKDIR ./app
RUN forge clean
RUN forge build


FROM oven/bun:1 AS base

# install dependencies into temp directory
# this will cache them and speed up future builds
# FROM base AS install
# RUN mkdir -p /temp/dev
# COPY package.json bun.lockb /temp/dev/
# RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
# RUN mkdir -p /temp/prod
# COPY package.json bun.lockb /temp/prod/
# RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
# FROM base AS prerelease
# COPY --from=install /temp/dev/node_modules node_modules
COPY --from=foundry ./app ./app
WORKDIR ./app

# [optional] tests & build
# ENV NODE_ENV=production
RUN cd ./integration-tests && bun install --frozen-lockfile
# CMD cd ./integration-tests && bun run test:only

# copy production dependencies and source code into final image

