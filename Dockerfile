FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

RUN chmod +x scripts/run-nightly-tests.sh scripts/container-service.sh

# Default command runs the in-container scheduler service
CMD ["bash", "scripts/container-service.sh"]
