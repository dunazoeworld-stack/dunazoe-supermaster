# DUNAZOE OS — Service Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S dunazoe && adduser -u 1001 -S dunazoe -G dunazoe
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Copy shared middleware into the container
COPY ../../shared ./shared
RUN chown -R dunazoe:dunazoe /app
USER dunazoe
EXPOSE ${PORT:-4000}
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4000}/health || exit 1
CMD ["node", "index.js"]

