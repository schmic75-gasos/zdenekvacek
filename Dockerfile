FROM golang:1.24-bookworm AS rosti-builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/rosti ./cmd/rosti
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/rosti ./cmd/rosti

FROM debian:bookworm

RUN DEBIAN_FRONTEND=noninteractive apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y wget gpg

RUN echo "deb http://deb.debian.org/debian/ bookworm main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://security.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian/ bookworm-updates main contrib non-free" >> /etc/apt/sources.list

RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y locales libffi-dev \
libssl-dev default-libmysqlclient-dev ca-certificates libpq-dev libjpeg62 libjpeg-dev \
libpng-dev libpng-dev build-essential git mercurial build-essential \
libbz2-dev libsqlite3-dev libreadline-dev zlib1g-dev libncurses5-dev \
libgdbm-dev libgd-dev cron git subversion vim nano mc htop procps \
dropbear gettext wget redis-server memcached supervisor curl ssh \
mariadb-client postgresql-client-15 postgresql-15-postgis-3-scripts bind9-host dnsutils nginx nginx-extras libnginx-mod-http-image-filter \
libxml2-dev libxslt1-dev openssh-sftp-server links2 lynx \
imagemagick libmagick++-6.q16-dev libmagick++-6.q16hdri-dev libmagickwand-dev ncdu libsodium-dev \
python3 python3-pip python3-virtualenv \
libcurl4-openssl-dev python3-dev libproj-dev gdal-bin libmemcached-dev swig mutt \
ffmpeg libyaml-dev libc-client2007e-dev libonig-dev libkrb5-dev dialog \
whiptail tmux rsync nmap libzip-dev libfreetype6-dev \
jpegoptim optipng pngquant gifsicle webp libvpx-dev libwebp-dev jq inotify-tools ripgrep \
wkhtmltopdf libzbar0

# This is stange thing in Debian 12, it blocks installation of chromium
RUN DEBIAN_FRONTEND=noninteractive apt-get remove -y luit
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y chromium

WORKDIR /srv

RUN useradd -d /srv app -s /bin/bash
RUN usermod -G crontab -a app
RUN rm /etc/localtime
RUN ln -s /usr/share/zoneinfo/Europe/Prague /etc/localtime

ADD /etc/locale.gen /etc/
RUN locale-gen
ENV LANG       en_US.UTF-8
ENV LC_ALL     en_US.UTF-8

ENV TERM       xterm

#############
# Techs
#############

## Node.js
# https://nodejs.org/en/about/previous-releases
WORKDIR /usr/src
ADD build_node.sh /usr/local/bin/build_node.sh
RUN build_node.sh 18.20.4
RUN build_node.sh 20.15.1
RUN build_node.sh 21.7.3
RUN build_node.sh 22.4.1

## Python
# https://www.python.org/downloads/
WORKDIR /usr/src
ADD build_python.sh /usr/local/bin/build_python.sh
RUN build_python.sh 3.11.9
RUN build_python.sh 3.12.4

## PHP 8
# https://www.php.net/downloads.php
ADD build_php8.sh /usr/local/bin/build_php8.sh
RUN build_php8.sh 8.2.15
RUN build_php8.sh 8.2.21
RUN build_php8.sh 8.3.6
RUN build_php8.sh 8.3.9

## Ruby
# https://www.ruby-lang.org/en/downloads/releases/
WORKDIR /usr/src
ADD build_ruby.sh /usr/local/bin/build_ruby.sh
RUN build_ruby.sh 3.2.2
RUN build_ruby.sh 3.3.1

## Deno
ADD build_deno.sh /usr/local/bin/build_deno.sh
# 2024/05
RUN build_deno.sh 1.43.6 
RUN build_deno.sh 1.45.1

# Bun
ADD build_bun.sh /usr/local/bin/build_bun.sh
RUN build_bun.sh 1.1.18

# OpenJDK
# From here: https://jdk.java.net/
ADD build_openjdk.sh /usr/local/bin/build_openjdk.sh
RUN build_openjdk.sh 22.0.2 c9ecb94cd31b495da20a27d4581645e8

# Golang
# From here: https://go.dev/dl/
ADD build_golang.sh /usr/local/bin/build_golang.sh
RUN build_golang.sh 1.22.5

RUN mkdir -p /usr/local/share/rosti && printf '%s\n' \
    'node 18.20.4 Node 0' \
    'node 20.15.1 Node 0' \
    'node 21.7.3 Node 0' \
    'node 22.4.1 Node 1' \
    'python 3.11.9 Python 0' \
    'python 3.12.4 Python 1' \
    'php 8.2.15 PHP 0' \
    'php 8.2.21 PHP 0' \
    'php 8.3.6 PHP 0' \
    'php 8.3.9 PHP 1' \
    'ruby 3.2.2 Ruby 0' \
    'ruby 3.3.1 Ruby 1' \
    'deno 1.43.6 Deno 0' \
    'deno 1.45.1 Deno 1' \
    'bun 1.1.18 Bun 1' \
    'openjdk 22.0.2 OpenJDK 1' \
    'golang 1.22.5 Golang 1' \
    > /usr/local/share/rosti/techs.txt


#############

# WKHTMLTOX This is not in development anymore so we will remove it with next version of Debian

WORKDIR /usr/src
RUN apt install -f xfonts-75dpi && \
      wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb && \
      dpkg -i wkhtmltox_0.12.6.1-3.bookworm_amd64.deb && \
      rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb

#############

## Support tools and miscellaneous stuff

RUN rm -f /etc/cron.d/* /etc/cron.daily/* /etc/cron.hourly/* /etc/cron.monthly/* /etc/cron.weekly/*

ADD /scripts/enable_redis.sh /usr/local/bin/enable-redis
ADD /scripts/enable_memcached.sh /usr/local/bin/enable-memcached
RUN chmod 755 /usr/local/bin/*

ADD /etc/supervisord.conf /etc/supervisor/supervisord.conf
ADD /examples /opt/examples
ADD /etc/bashrc_local /opt/etc/bashrc_local
ADD /etc/bash_profile /opt/etc/bash_profile
ADD /etc/vimrc /opt/etc/vimrc
RUN mkdir -p /opt/etc/bashrc
RUN mkdir -p /opt/etc/appinit
ADD /etc/bashrc/common.sh /opt/etc/bashrc/
ADD /etc/nginx.conf /etc/nginx/nginx.conf

RUN rmdir /var/lib/nginx
RUN ln -s /srv/var/nginx /var/lib/nginx
RUN chown app:app /var/log/nginx -R

RUN chown app:app /home -R

# Start script

ADD /start.sh /start.sh
RUN chmod 755 /start.sh

## Roští script

RUN mkdir -p /usr/local/lib/rosti
ADD ./rosti-actions.sh /usr/local/lib/rosti/actions.sh
COPY --from=rosti-builder /out/rosti /usr/local/bin/rosti
RUN chmod 755 /usr/local/bin/rosti /usr/local/lib/rosti/actions.sh

## Cleaning
RUN apt-get clean && rm -rf /usr/src/*


VOLUME /srv
WORKDIR /srv
EXPOSE 8000 22

ENTRYPOINT ["/start.sh"]
