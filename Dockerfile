FROM node:24-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
# Copy workspace manifests so `npm ci` can validate workspaces against the lockfile
COPY extensions/capped-order-discount/package.json extensions/capped-order-discount/
COPY extensions/free-gift-discount/package.json extensions/free-gift-discount/
RUN npm ci && npm cache clean --force

# Generate the latest Prisma client inside the image. `prisma generate` never
# connects to the DB — it only needs a syntactically valid URL matching the
# mysql provider (same placeholder as env.example.txt). Generating here (not on
# a dev machine) also pulls the correct linux-musl query-engine binary.
COPY prisma ./prisma
RUN DATABASE_URL="mysql://user:pass@localhost:3306/placeholder" npx prisma generate

COPY . .

RUN npm run build

# Runtime image keeps production dependencies only.
ENV NODE_ENV=production
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "docker-start"]