FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Default command to run tests
CMD ["bash", "scripts/run-nightly-tests.sh"]
