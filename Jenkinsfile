pipeline {

    agent any

    options {
        timestamps()
        disableConcurrentBuilds()

        buildDiscarder(
            logRotator(
                numToKeepStr: '10',
                artifactNumToKeepStr: '5'
            )
        )
    }

    environment {
        APP_NAME = 'essl-monitor'

        BACKEND_IMAGE = 'essl-monitor-backend:latest'
        FRONTEND_IMAGE = 'essl-monitor-frontend:latest'

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        DOCKER_NETWORK = 'essl-monitor-network'

        BACKEND_PORT = '5001'
        FRONTEND_PORT = '8081'

        ENV_FILE = '/opt/essl-monitor/.env'
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

                    echo ""
                    echo "Node:"
                    node -v

                    echo ""
                    echo "NPM:"
                    npm -v

                    echo ""
                    echo "Git:"
                    git --version

                    echo ""
                    echo "Docker:"
                    docker --version

                    echo ""
                    echo "Docker Compose:"
                    docker compose version

                    echo ""
                    echo "PostgreSQL:"
                    psql --version

                    echo ""
                    echo "Docker access:"
                    docker ps

                    echo ""
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

                    echo ""
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

EXPOSE 5000

CMD ["npm", "start"]
EOF

                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
EOF

                    cat > essl-monitor/frontend/default.conf <<'EOF'
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

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE not found."
                        exit 1
                    fi

                    echo ".env found."

                    echo ""
                    echo "Checking required variables..."

                    missing=0

                    check_var() {
                        VAR_NAME="$1"

                        if ! grep -Eq "^${VAR_NAME}=" "$ENV_FILE"; then
                            echo "${VAR_NAME}: MISSING"
                            missing=1
                            return
                        fi

                        VALUE=$(grep -E "^${VAR_NAME}=" "$ENV_FILE" \
                            | head -n 1 \
                            | cut -d '=' -f 2-)

                        if [ -z "$VALUE" ]; then
                            echo "${VAR_NAME}: EMPTY"
                            missing=1
                        else
                            echo "${VAR_NAME}: OK"
                        fi
                    }

                    check_var PGHOST
                    check_var PGUSER
                    check_var PGPASSWORD
                    check_var PGDATABASE
                    check_var DEVICES
                    check_var JWT_SECRET

                    if [ "$missing" -ne 0 ]; then
                        echo ""
                        echo "ERROR: Required environment variables are missing."
                        exit 1
                    fi

                    echo ""
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

                        echo ""
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

                    PGHOST_VALUE=$(grep '^PGHOST=' "$ENV_FILE" \
                        | head -n 1 | cut -d '=' -f 2-)

                    PGUSER_VALUE=$(grep '^PGUSER=' "$ENV_FILE" \
                        | head -n 1 | cut -d '=' -f 2-)

                    PGPASSWORD_VALUE=$(grep '^PGPASSWORD=' "$ENV_FILE" \
                        | head -n 1 | cut -d '=' -f 2-)

                    PGDATABASE_VALUE=$(grep '^PGDATABASE=' "$ENV_FILE" \
                        | head -n 1 | cut -d '=' -f 2-)

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

                    echo ""
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

                        export $(grep -v '^#' "$ENV_FILE" \
                            | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' \
                            | xargs)

                        npm run migrate

                        echo ""
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

                    if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
                        docker network create "$DOCKER_NETWORK"
                        echo "Docker network created."
                    else
                        echo "Docker network already exists."
                    fi

                    echo "Docker network ready: $DOCKER_NETWORK"
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

                    echo ""
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

                    echo ""
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

                    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
                    docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true

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
                        echo "Port ${BACKEND_PORT}: already in use"
                        exit 1
                    fi

                    if ss -ltn | grep -q ":${FRONTEND_PORT} "; then
                        echo "Port ${FRONTEND_PORT}: already in use"
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
                        --env-file "$ENV_FILE" \
                        --network "$DOCKER_NETWORK" \
                        -p 5001:5000 \
                        "$BACKEND_IMAGE"

                    echo ""
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
                        --network "$DOCKER_NETWORK" \
                        -p 8081:80 \
                        "$FRONTEND_IMAGE"

                    echo ""
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

                    echo ""
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

                        HTTP_CODE=$(curl -sS \
                            -o /tmp/backend-health.json \
                            -w "%{http_code}" \
                            --max-time 5 \
                            http://127.0.0.1:5001/api/ || true)

                        echo "Backend HTTP status: $HTTP_CODE"

                        # 200 = normal success
                        # 401 = backend is alive but authentication is required
                        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then

                            echo "Backend is healthy."

                            cat /tmp/backend-health.json

                            SUCCESS=1
                            break
                        fi

                        echo "Backend not ready yet. Attempt $i/10"

                        sleep 3
                    done

                    if [ "$SUCCESS" -ne 1 ]; then

                        echo ""
                        echo "ERROR: Backend health check failed."

                        echo ""
                        echo "Backend container status:"
                        docker ps -a \
                            --filter "name=$BACKEND_CONTAINER"

                        echo ""
                        echo "Backend logs:"
                        docker logs "$BACKEND_CONTAINER" --tail 100

                        exit 1
                    fi

                    echo ""
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

                    SUCCESS=0

                    for i in $(seq 1 10); do

                        if curl -fsS \
                            --max-time 5 \
                            http://127.0.0.1:8081/ \
                            >/tmp/frontend-health.html 2>/dev/null; then

                            echo "Frontend is healthy."

                            SUCCESS=1
                            break
                        fi

                        echo "Frontend not ready yet. Attempt $i/10"

                        sleep 2
                    done

                    if [ "$SUCCESS" -ne 1 ]; then

                        echo ""
                        echo "ERROR: Frontend health check failed."

                        echo ""
                        echo "Frontend logs:"
                        docker logs "$FRONTEND_CONTAINER" --tail 100

                        exit 1
                    fi

                    echo ""
                    echo "Frontend health check: OK"
                '''
            }
        }

        stage('API Proxy Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        API PROXY CHECK"
                    echo "=========================================="

                    HTTP_CODE=$(curl -sS \
                        -o /tmp/api-proxy.json \
                        -w "%{http_code}" \
                        --max-time 5 \
                        http://127.0.0.1:8081/api/ || true)

                    echo "API proxy HTTP status: $HTTP_CODE"

                    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
                        echo "API reverse proxy: OK"
                        cat /tmp/api-proxy.json
                    else
                        echo "ERROR: API reverse proxy failed."

                        docker logs "$FRONTEND_CONTAINER" --tail 100

                        exit 1
                    fi
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
                        --filter "name=$FRONTEND_CONTAINER"

                    echo ""
                    echo "Backend:"
                    docker inspect \
                        --format='{{.State.Status}}' \
                        "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend:"
                    docker inspect \
                        --format='{{.State.Status}}' \
                        "$FRONTEND_CONTAINER"
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo ""
                    echo "===================================================="
                    echo "           DEPLOYMENT SUCCESSFUL"
                    echo "===================================================="

                    echo ""
                    echo "Application:"
                    echo "eSSL Attendance Monitor"

                    echo ""
                    echo "Backend:"
                    echo "http://172.16.0.111:5001"

                    echo ""
                    echo "Frontend:"
                    echo "http://172.16.0.111:8081"

                    echo ""
                    echo "API:"
                    echo "http://172.16.0.111:5001/api"

                    echo ""
                    echo "Containers:"
                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"

                    echo ""
                    echo "===================================================="
                '''
            }
        }
    }

    post {

        success {
            echo "Jenkins Docker deployment completed successfully."

            sh '''
                echo ""
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT SUCCESS"
                echo "===================================================="

                docker ps \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER"

                echo ""
                echo "Dashboard:"
                echo "http://172.16.0.111:8081"

                echo ""
                echo "API:"
                echo "http://172.16.0.111:5001/api"

                echo "===================================================="
            '''
        }

        failure {
            echo "Jenkins Docker deployment failed."

            sh '''
                echo ""
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT FAILED"
                echo "===================================================="

                echo ""
                echo "Containers:"
                docker ps -a \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER"

                echo ""
                echo "Backend logs:"
                docker logs "$BACKEND_CONTAINER" --tail 100 2>/dev/null || true

                echo ""
                echo "Frontend logs:"
                docker logs "$FRONTEND_CONTAINER" --tail 100 2>/dev/null || true

                echo ""
                echo "Port 5001:"
                ss -ltnp | grep ":5001 " || true

                echo ""
                echo "Port 8081:"
                ss -ltnp | grep ":8081 " || true

                echo ""
                echo "===================================================="
            '''
        }
    }
}
