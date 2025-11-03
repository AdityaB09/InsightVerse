FROM node:20-alpine
WORKDIR /app

# Copy only package.json (no lockfile required)
COPY package.json ./

# Install deps (includes dev deps for Vite)
RUN npm install

# Now copy the rest and run the dev server
COPY . .
ENV HOST=0.0.0.0
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
