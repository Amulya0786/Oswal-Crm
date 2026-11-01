FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --include=dev
COPY . .
ARG NEXT_PUBLIC_DEMO_HINTS=0
ENV NEXT_PUBLIC_DEMO_HINTS=$NEXT_PUBLIC_DEMO_HINTS
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate && npm run build \
 && mkdir -p .next/standalone/node_modules .next/standalone/public .next/standalone/.next/static \
 && cp -a node_modules/.prisma .next/standalone/node_modules/.prisma \
 && cp -a node_modules/@prisma .next/standalone/node_modules/@prisma \
 && cp -a node_modules/prisma .next/standalone/node_modules/prisma \
 && cp -a node_modules/bcryptjs .next/standalone/node_modules/bcryptjs \
 && cp -a prisma .next/standalone/prisma \
 && cp -a scripts .next/standalone/scripts \
 && cp -a public/. .next/standalone/public/ \
 && cp -a .next/static/. .next/standalone/.next/static/
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/bootstrap.mjs && node .next/standalone/server.js"]
