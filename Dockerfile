FROM node:20-alpine3.18 AS frontend-builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM rust:1.75-alpine3.18 AS rust-builder

WORKDIR /app

RUN apk add --no-cache \
    build-base \
    libx11-dev \
    libxcb-dev \
    libxkbcommon-dev \
    dbus-dev \
    glib-dev \
    pango-dev \
    cairo-dev \
    atk-dev \
    gdk-pixbuf-dev \
    gtk+3.0-dev \
    libsoup-dev \
    webkit2gtk-dev \
    librsvg-dev \
    libjpeg-turbo-dev \
    tiff-dev \
    freetype-dev \
    fontconfig-dev \
    openssl-dev \
    alsa-lib-dev

COPY src-tauri/Cargo.toml ./src-tauri/
COPY src-tauri/Cargo.lock ./src-tauri/

RUN cd src-tauri && cargo fetch

COPY src-tauri ./src-tauri
COPY --from=frontend-builder /app/dist ./dist

RUN cd src-tauri && cargo build --release

FROM alpine:3.18

RUN apk add --no-cache \
    gtk+3.0 \
    webkit2gtk \
    libsoup \
    librsvg \
    dbus \
    alsa-lib \
    libx11 \
    libxcb \
    libxkbcommon \
    fontconfig \
    ttf-dejavu

WORKDIR /app

COPY --from=rust-builder /app/src-tauri/target/release/midi-mapper-debugger ./midi-mapper-debugger

EXPOSE 1420

ENTRYPOINT ["./midi-mapper-debugger"]
