# Build the static frontend and serve it with nginx.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback so client-side routes work on refresh.
RUN printf 'server {\n listen 80;\n location / {\n  root /usr/share/nginx/html;\n  try_files $uri /index.html;\n }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
