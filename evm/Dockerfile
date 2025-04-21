FROM ghcr.io/foundry-rs/foundry as builder

WORKDIR /app
COPY foundry.toml foundry.toml
COPY lib lib
COPY src src

RUN FOUNDRY_PROFILE=ir forge build

FROM scratch AS foundry-export

COPY --from=builder /app/out .
