FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run development server with host exposure
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
