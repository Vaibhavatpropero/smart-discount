FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

COPY . .

RUN npm run build

# Runtime image keeps production dependencies only.
ENV NODE_ENV=production
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "docker-start"]