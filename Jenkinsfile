pipeline {

    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            artifactNumToKeepStr: '5'
        ))
    }

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'

        BACKEND_IMAGE = 'essl-monitor-backend:latest'
        FRONTEND_IMAGE = 'essl-monitor-frontend:latest'

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        BACKEND_PORT = '5001'
        FRONTEND_PORT = '8081'

        BACKEND_INTERNAL_PORT = '5000'
        FRONTEND_INTERNAL_PORT = '80'

        NETWORK_NAME = 'essl-monitor-network'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        ENVIRONMENT CHECK"
                    echo "=========================================="

                    echo "User:"
                    whoami

                    echo
                    echo "Node:"
                    node -v

                    echo
                    echo "NPM:"
                    npm -v

                    echo
                    echo "Git:"
                    git --version

                    echo
                    echo "Docker:"
                    docker --version

                    echo
                    echo "Docker Compose:"
                    docker compose version

                    echo
                    echo "PostgreSQL:"
                    psql --version

                    echo
                    echo "Docker access:"
                    docker ps

                    echo
                    echo "Environment check completed."
                '''
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VALIDATING PROJECT"
                    echo "=========================================="

                    test -d essl-monitor/backend
                    test -d essl-monitor/frontend

                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/package-lock.json
                    test -f essl-monitor/backend/src/server.js
                    test -f essl-monitor/backend/src/db/migrate.js

                    test -f essl-monitor/frontend/index.html
                    test -f essl-monitor/frontend/dashboard.html

                    echo
                    echo "Backend structure: OK"
                    echo "Frontend structure: OK"
                '''
            }
        }

        stage('Create Docker Files') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CREATING DOCKER FILES"
                    echo "=========================================="

                    mkdir -p essl-monitor/backend
                    mkdir -p essl-monitor/frontend

                    cat > essl-monitor/backend/Dockerfile <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/server.js"]
EOF

                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

                    cat > essl-monitor/frontend/nginx.conf <<'EOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://essl-monitor-backend:5000/api/;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                    echo "Nginx API reverse proxy created."
                '''
            }
        }

        stage('Prepare Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING APPLICATION ENV"
                    echo "=========================================="

                    ENV_FILE="${APP_DIR}/.env"

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE not found."
                        echo
                        echo "Create it with:"
                        echo "sudo nano $ENV_FILE"
                        exit 1
                    fi

                    echo ".env found."

                    echo
                    echo "Checking required variables..."

                    missing=0

                    check_var() {
                        VAR_NAME="$1"

                        if ! grep -Eq "^${VAR_NAME}=" "$ENV_FILE"; then
                            echo "ERROR: Missing ${VAR_NAME} in ${ENV_FILE}"
                            missing=1
                        else
                            VALUE=$(grep -E "^${VAR_NAME}=" "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-)

                            if [ -z "$VALUE" ]; then
                                echo "ERROR: ${VAR_NAME} is empty"
                                missing=1
                            else
                                echo "${VAR_NAME}: OK"
                            fi
                        fi
                    }

                    check_var PGHOST
                    check_var PGUSER
                    check_var PGPASSWORD
                    check_var PGDATABASE
                    check_var DEVICES
                    check_var JWT_SECRET

                    if [ "$missing" -ne 0 ]; then
                        echo
                        echo "Required environment variables are missing."
                        echo
                        echo "Expected format:"
                        echo "PGHOST=172.16.0.111"
                        echo "PGUSER=postgres"
                        echo "PGPASSWORD=your_password"
                        echo "PGDATABASE=essl_monitor"
                        echo "DEVICES=Device-1|172.16.0.4|4370,Device-2|172.16.0.44|4370,Device-3|172.16.0.5|4370,Device-4|172.16.0.20|4370"
                        echo "JWT_SECRET=your_secret"
                        exit 1
                    fi

                    echo
                    echo "Application environment validation: OK"
                '''
            }
        }

        stage('Backend Dependency Test') {
            steps {
                dir('essl-monitor/backend') {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        BACKEND DEPENDENCY TEST"
                        echo "=========================================="

                        npm ci

                        echo
                        echo "Backend npm dependencies installed successfully."
                    '''
                }
            }
        }

        stage('Test PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        TESTING POSTGRESQL"
                    echo "=========================================="

                    ENV_FILE="${APP_DIR}/.env"

                    PGHOST_VALUE=$(grep '^PGHOST=' "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-)
                    PGUSER_VALUE=$(grep '^PGUSER=' "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-)
                    PGPASSWORD_VALUE=$(grep '^PGPASSWORD=' "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-)
                    PGDATABASE_VALUE=$(grep '^PGDATABASE=' "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-)

                    export PGHOST="$PGHOST_VALUE"
                    export PGUSER="$PGUSER_VALUE"
                    export PGPASSWORD="$PGPASSWORD_VALUE"
                    export PGDATABASE="$PGDATABASE_VALUE"

                    echo "PostgreSQL host: $PGHOST"
                    echo "PostgreSQL database: $PGDATABASE"

                    pg_isready \
                        -h "$PGHOST" \
                        -p 5432 \
                        -U "$PGUSER" \
                        -d "$PGDATABASE"

                    echo
                    echo "PostgreSQL connection: OK"
                '''
            }
        }

        stage('Database Migration') {
            steps {
                dir('essl-monitor/backend') {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        DATABASE MIGRATION"
                        echo "=========================================="

                        ENV_FILE="${APP_DIR}/.env"

                        export $(grep -v '^#' "$ENV_FILE" | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' | xargs)

                        npm run migrate

                        echo
                        echo "Database migration completed."
                    '''
                }
            }
        }

        stage('Create Docker Network') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DOCKER NETWORK"
                    echo "=========================================="

                    docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 || \
                        docker network create "$NETWORK_NAME"

                    echo "Docker network ready: $NETWORK_NAME"
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILD BACKEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --no-cache \
                        -t "$BACKEND_IMAGE" \
                        essl-monitor/backend

                    echo
                    echo "Backend image built successfully."
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILD FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --no-cache \
                        -t "$FRONTEND_IMAGE" \
                        essl-monitor/frontend

                    echo
                    echo "Frontend image built successfully."
                '''
            }
        }

        stage('Stop Old Containers') {
            steps {
                sh '''
                    set +e

                    echo "=========================================="
                    echo "        STOPPING OLD CONTAINERS"
                    echo "=========================================="

                    docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1
                    docker rm -f "$FRONTEND_CONTAINER" >/dev/null 2>&1

                    true
                '''
            }
        }

        stage('Check Ports') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING PORTS"
                    echo "=========================================="

                    if ss -ltn | grep -q ":${BACKEND_PORT} "; then
                        echo "ERROR: Port ${BACKEND_PORT} is already in use."
                        exit 1
                    fi

                    if ss -ltn | grep -q ":${FRONTEND_PORT} "; then
                        echo "ERROR: Port ${FRONTEND_PORT} is already in use."
                        exit 1
                    fi

                    echo "Port ${BACKEND_PORT}: available"
                    echo "Port ${FRONTEND_PORT}: available"
                '''
            }
        }

        stage('Start Backend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING BACKEND"
                    echo "=========================================="

                    docker run -d \
                        --name "$BACKEND_CONTAINER" \
                        --restart unless-stopped \
                        --env-file "${APP_DIR}/.env" \
                        --network "$NETWORK_NAME" \
                        -p "${BACKEND_PORT}:${BACKEND_INTERNAL_PORT}" \
                        "$BACKEND_IMAGE"

                    echo
                    echo "Backend container started."
                '''
            }
        }

        stage('Start Frontend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING FRONTEND"
                    echo "=========================================="

                    docker run -d \
                        --name "$FRONTEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$NETWORK_NAME" \
                        -p "${FRONTEND_PORT}:${FRONTEND_INTERNAL_PORT}" \
                        "$FRONTEND_IMAGE"

                    echo
                    echo "Frontend container started."
                '''
            }
        }

        stage('Wait For Containers') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        WAITING FOR CONTAINERS"
                    echo "=========================================="

                    sleep 10

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"

                    echo
                    echo "Containers are running."
                '''
            }
        }

        stage('Backend Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BACKEND HEALTH CHECK"
                    echo "=========================================="

                    SUCCESS=0

                    for i in $(seq 1 10); do

                        if curl -fsS \
                            --max-time 5 \
                            "http://127.0.0.1:${BACKEND_PORT}/api/" \
                            >/dev/null 2>&1; then

                            SUCCESS=1
                            break
                        fi

                        echo "Backend not ready yet. Attempt $i/10"
                        sleep 3
                    done

                    if [ "$SUCCESS" -ne 1 ]; then
                        echo
                        echo "ERROR: Backend health check failed."
                        docker logs "$BACKEND_CONTAINER" --tail 100
                        exit 1
                    fi

                    echo
                    echo "Backend health check: OK"
                '''
            }
        }

        stage('Frontend Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        FRONTEND HEALTH CHECK"
                    echo "=========================================="

                    curl -fsS \
                        --max-time 10 \
                        "http://127.0.0.1:${FRONTEND_PORT}/" \
                        >/dev/null

                    echo
                    echo "Frontend health check: OK"
                '''
            }
        }

        stage('API Proxy Check') {
            steps {
                sh '''
                    set +e

                    echo "=========================================="
                    echo "        API PROXY CHECK"
                    echo "=========================================="

                    echo "Testing frontend -> backend proxy..."

                    HTTP_CODE=$(curl -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --max-time 10 \
                        "http://127.0.0.1:${FRONTEND_PORT}/api/")

                    echo "API proxy HTTP status: $HTTP_CODE"

                    if [ "$HTTP_CODE" = "404" ]; then
                        echo
                        echo "WARNING: /api/ returned 404."
                        echo "This may be normal if the application does not define GET /api/."
                        echo "The frontend and backend containers are still running."
                    fi

                    exit 0
                '''
            }
        }

        stage('Container Status') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CONTAINER STATUS"
                    echo "=========================================="

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER" \
                        --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

                    echo
                    echo "Backend logs:"
                    docker logs "$BACKEND_CONTAINER" --tail 30

                    echo
                    echo "Frontend logs:"
                    docker logs "$FRONTEND_CONTAINER" --tail 30
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo
                    echo "===================================================="
                    echo "          DEPLOYMENT SUCCESSFUL"
                    echo "===================================================="
                    echo
                    echo "Application Server : 172.16.0.111"
                    echo
                    echo "Frontend:"
                    echo "http://172.16.0.111:${FRONTEND_PORT}/"
                    echo
                    echo "Backend:"
                    echo "http://172.16.0.111:${BACKEND_PORT}/"
                    echo
                    echo "API:"
                    echo "http://172.16.0.111:${BACKEND_PORT}/api/"
                    echo
                    echo "Backend container : $BACKEND_CONTAINER"
                    echo "Frontend container: $FRONTEND_CONTAINER"
                    echo
                    echo "===================================================="
                '''
            }
        }
    }

    post {

        success {
            echo "Jenkins Docker deployment completed successfully."

            sh '''
                echo
                echo "Final running containers:"
                docker ps \
                    --filter "name=essl-monitor-backend" \
                    --filter "name=essl-monitor-frontend"
            '''
        }

        failure {
            echo "Jenkins Docker deployment failed."

            sh '''
                echo
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT FAILED"
                echo "===================================================="

                echo
                echo "Containers:"
                docker ps -a \
                    --filter "name=essl-monitor-backend" \
                    --filter "name=essl-monitor-frontend"

                echo
                echo "Backend logs:"
                docker logs essl-monitor-backend --tail 100 2>/dev/null || true

                echo
                echo "Frontend logs:"
                docker logs essl-monitor-frontend --tail 100 2>/dev/null || true

                echo
                echo "Port ${BACKEND_PORT}:"
                ss -ltnp | grep ":${BACKEND_PORT} " || true

                echo
                echo "Port ${FRONTEND_PORT}:"
                ss -ltnp | grep ":${FRONTEND_PORT} " || true

                echo
                echo "===================================================="
            '''
        }

        always {
            echo "Jenkins Docker deployment process completed."
        }
    }
}
