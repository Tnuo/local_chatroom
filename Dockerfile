FROM node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e AS client-builder

WORKDIR /client

COPY client/package.json ./
RUN npm install

COPY client/ ./
RUN npm run build

FROM node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/ ./
COPY --from=client-builder /client/dist /app/client/dist

RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

CMD ["node", "index.js"]
