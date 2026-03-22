FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache bash

SHELL ["/bin/bash", "-lc"]

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY start.sh /app/start.sh

RUN npm install --omit=dev && chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
