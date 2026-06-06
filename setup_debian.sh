#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Clear screen
clear

echo "================================================================="
# Clean banner
echo "       SIDEVIEW DEBIAN DROPLET AUTOMATED SETUP SCRIPT            "
echo "================================================================="
echo ""

# Ask for domain name
read -p "Enter your domain name (e.g., sideview.yourdomain.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "ERROR: Domain cannot be empty!"
    exit 1
fi

echo "Using domain: $DOMAIN"
echo ""

# 1. Update package list and install initial utilities
echo "--> 1/6 Updating packages and installing prerequisites..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx git

# 2. Set up Docker GPG keys and install Docker Engine + Compose
echo "--> 2/6 Configuring Docker repositories and installing Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
sudo rm -f /etc/apt/keyrings/docker.asc # Clean old keys if any
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker Apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Create docker-compose.yml configuration
echo "--> 3/6 Generating docker-compose.yml..."
cat <<EOF > docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - NODE_ENV=production
      - ALLOWED_ORIGINS=https://$DOMAIN
    restart: always

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_SOCKET_URL=https://$DOMAIN
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: always
EOF

# 4. Configure Nginx Server Blocks
echo "--> 4/6 Configuring Nginx reverse proxy..."
cat <<EOF > /etc/nginx/sites-available/sideview
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /peerjs/ {
        proxy_pass http://127.0.0.1:8080/peerjs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Link configuration file and disable default site
sudo ln -sf /etc/nginx/sites-available/sideview /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

# 5. Certbot Let's Encrypt SSL configuration
echo "--> 5/6 Setting up Let's Encrypt HTTPS certificates..."
sudo certbot --nginx -d $DOMAIN

# 6. Build and start Docker Compose containers
echo "--> 6/6 Rebuilding and starting the application containers..."
sudo docker compose build --no-cache
sudo docker compose up -d

echo ""
echo "================================================================="
echo "  SUCCESS: Sideview is now running securely on https://$DOMAIN"
echo "================================================================="
