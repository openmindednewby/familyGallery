# Stage 1 BUILD
#FROM node:latest as node
FROM node:18 as node
LABEL author="Jimmy Walker"
WORKDIR /app
COPY package.json package.json
RUN npm config set legacy-peer-deps true
RUN npm install -g ionic
RUN npm install
COPY . .
RUN ionic build --prod

# Stage 2 copy build into nginx
FROM nginx:alpine
VOLUME /var/cache/nginx
COPY --from=node /app/www /usr/share/nginx/html

# Stage 3 docker build -t family-gallery -f nginx.prod.dockerfile .
# Stage 4 docker run -dp 4298:80 family-gallery -network=internal-docker --ip=172.18.0.12 ionic-example-app


