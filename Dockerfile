FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache bash

SHELL ["/bin/bash", "-lc"]

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "server.js"]
