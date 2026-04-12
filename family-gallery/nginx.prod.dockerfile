# Stage 1 BUILD
#FROM node:latest as node
FROM node:18 as node
LABEL author="Jimmy Walker"
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set legacy-peer-deps true
RUN npm install -g ionic
# Use npm ci to install from lock file (deterministic, respects overrides)
RUN npm ci
COPY . .
RUN ionic build --prod

# Stage 2 copy build into nginx
FROM nginx:alpine
VOLUME /var/cache/nginx
COPY --from=node /app/www /usr/share/nginx/html

# Stage 3 docker build -t family-gallery -f nginx.prod.dockerfile .
# Stage 4 ddocker run -dp 4298:80 --name family-gallery --network=internal-docker --ip=172.18.0.4 family-gallery



