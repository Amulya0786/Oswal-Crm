FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --include=dev
COPY . .
# If the app spec has not set DIRECT_URL yet, Prisma expands this from DATABASE_URL at migrate time.
RUN printf '%s\n' 'DIRECT_URL="${DATABASE_URL}"' > .env
ARG NEXT_PUBLIC_DEMO_HINTS=0
ENV NEXT_PUBLIC_DEMO_HINTS=$NEXT_PUBLIC_DEMO_HINTS
ENV NODE_OPTIONS="--require /app/scripts/direct-url.cjs --max-old-space-size=448"
RUN npx prisma generate && npm run build \
 && mkdir -p .next/standalone/public .next/standalone/.next/static \
 && rm -rf .next/standalone/node_modules \
 && cp -a node_modules .next/standalone/node_modules \
 && cp -a prisma .next/standalone/prisma \
 && cp -a scripts .next/standalone/scripts \
 && cp -a public/. .next/standalone/public/ \
 && cp -a .next/static/. .next/standalone/.next/static/ \
 && mkdir -p .next/standalone/data \
 && cp -a data/masters .next/standalone/data/masters
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The build value must not leak into runtime. An empty value lets direct-url.cjs copy DATABASE_URL.
ENV DIRECT_URL=
# Leave room in the 1GB instance for the system and Prisma. The paid size stays apps-s-1vcpu-1gb.
# direct-url.cjs copies DATABASE_URL into DIRECT_URL when the app spec has not set it yet.
EXPOSE 3000
# Migrations run in the App Platform pre-deploy job. Starting only the server keeps this process small enough to pass the health check.
CMD ["node", ".next/standalone/server.js"]
