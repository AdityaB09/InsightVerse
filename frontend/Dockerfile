FROM node:20-alpine AS web

WORKDIR /app

# copy manifests first for better caching
COPY package.json package-lock.json* ./

# if a lockfile exists, use ci; otherwise do a normal install
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm install --no-audit --no-fund; \
    fi

# now copy the source and build
COPY . .
RUN npm run build

# preview/runtime image if you serve static with vite preview
EXPOSE 5173
CMD ["npm", "run", "preview"]
