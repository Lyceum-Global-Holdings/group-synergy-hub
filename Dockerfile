FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Match CI: the dependency tree has peer-dep conflicts that require legacy
# resolution (see .github/workflows/ci.yml install step).
RUN npm install --legacy-peer-deps

COPY . .

# Heavy vendor chunks exceed Node's default heap → OOM during the build.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview"]