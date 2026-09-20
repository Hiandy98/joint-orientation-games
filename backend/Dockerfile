FROM node:24-alpine AS base
WORKDIR /app
RUN mkdir -p /app && chown node:node /app
COPY --chown=node:node package*.json ./

FROM base AS development
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=4096"
USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
