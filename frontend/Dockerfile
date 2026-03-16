FROM node:20-slim

WORKDIR /app

# Install dependencies (cached layer — only re-runs when package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server bound to all interfaces (required for Docker networking)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
