# ==========================================
# STAGE 1: Build Frontend Assets
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Salin package.json & lock untuk memanfaatkan cache layer Docker
COPY package*.json ./
RUN npm ci

# Salin aset frontend dan config
COPY resources/ ./resources/
COPY public/ ./public/
COPY tailwind.config.js vite.config.js postcss.config.js jsconfig.json ./

# Build aset frontend (output ke public/build)
RUN npm run build

# ==========================================
# STAGE 2: PHP FPM Runtime
# ==========================================
FROM php:8.3-fpm-alpine
WORKDIR /var/www

# Install dependensi sistem dan ekstensi PHP
RUN apk add --no-cache \
    zip \
    unzip \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    oniguruma-dev \
    libjpeg-turbo-dev \
    freetype-dev

RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) pdo_mysql gd mbstring zip bcmath opcache

# Copy Composer dari image composer resmi
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Salin seluruh kode proyek
COPY . .

# Hapus folder node_modules dan public/build agar diganti dengan build bersih
RUN rm -rf node_modules public/build

# Salin hasil build Vite dari Stage 1
COPY --from=frontend-builder /app/public/build ./public/build

# Jalankan instalasi composer untuk produksi
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-interaction --no-dev --optimize-autoloader

# Atur izin direktori untuk Laravel
RUN chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

# Port default PHP-FPM
EXPOSE 9000

CMD ["php-fpm"]
