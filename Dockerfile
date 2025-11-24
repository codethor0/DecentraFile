FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package.json package-lock.json ./

RUN npm ci && \
    npm cache clean --force

COPY . .

RUN npx hardhat compile

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["node", "scripts/start-local.js"]

