FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --production --frozen-lockfile --ignore-engines 2>/dev/null || yarn install --production --ignore-engines
RUN yarn add ts-node tsconfig-paths --ignore-engines

COPY src/core ./src/core
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY tsconfig.json ./

RUN mkdir -p /app/config /app/custom-conditions /app/logs

EXPOSE 3001

CMD ["npx", "ts-node", "-r", "tsconfig-paths/register", "src/server/main.ts"]
