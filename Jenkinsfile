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

        APP_DIR = '/opt/essl-monitor'

        PROJECT_DIR = 'essl-monitor'

        BACKEND_DIR = 'essl-monitor/backend'
        FRONTEND_DIR = 'essl-monitor/frontend'

        BACKEND_IMAGE = 'essl-monitor-backend:latest'
        FRONTEND_IMAGE = 'essl-monitor-frontend:latest'

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        BACKEND_PORT = '5001'
        FRONTEND_PORT = '8081'
        INTERNAL_BACKEND_PORT = '5000'

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

                    test -d "${PROJECT_DIR}/backend"
                    test -d "${PROJECT_DIR}/frontend"

                    test -f "${PROJECT_DIR}/backend/package.json"
                    test -f "${PROJECT_DIR}/backend/package-lock.json"
                    test -f "${PROJECT_DIR}/backend/src/server.js"
                    test -f "${PROJECT_DIR}/backend/src/db/migrate.js"

                    test -f "${PROJECT_DIR}/frontend/index.html"
                    test -f "${PROJECT_DIR}/frontend/dashboard.html"

                    echo
                    echo "Backend structure: OK"
                    echo "Frontend structure: OK"
                '''
            }
        }

        stage('Prepare Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING APPLICATION ENV"
                    echo "=========================================="

                    if [ ! -f "${APP_DIR}/.env" ]; then
                        echo "ERROR: ${APP_DIR}/.env does not exist."
                        exit 1
                    fi

                    echo ".env found."

                    echo
                    echo "Checking required environment variables..."

                    required_vars="
                    PGHOST
                    PGUSER
                    PGPASSWORD
                    PGDATABASE
                    DEVICES
                    "

                    missing=0

                    while IFS= read -r var
                    do
                        [ -z "$var" ] && continue

                        value=$(grep -E "^${var}=" "${APP_DIR}/.env" | tail -1 | cut -d= -f2- || true)

                        if [ -z "$value" ]; then
                            echo "WARNING: ${var} is missing or empty"
                            missing=1
                        else
                            case "$var" in
                                PGPASSWORD)
                                    echo "${var}: configured"
                                    ;;
                                *)
                                    echo "${var}: configured"
                                    ;;
                            esac
                        fi

                    done <<EOF
                    ${required_vars}
                    EOF

                    if [ "$missing" -ne 0 ]; then
                        echo
                        echo "ERROR: Required .env variables are missing."
                        exit 1
                    fi

                    echo
                    echo "Configured devices:"

                    grep '^DEVICES=' "${APP_DIR}/.env" \
                        | sed 's/,/\\n/g' \
                        | sed 's/|/:/g' \
                        | sed 's/^/  /'

                    echo
                    echo "Application environment check completed."
                '''
            }
        }

        stage('Backend Dependency Test') {
            steps {
                dir("${BACKEND_DIR}") {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        BACKEND DEPENDENCY TEST"
                        echo "=========================================="

                        npm ci

                        echo
                        echo "Backend dependencies installed successfully."

                        node --check src/server.js

                        echo
                        echo "server.js syntax: OK"
                    '''
                }
            }
        }

        stage('Test PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        POSTGRESQL CONNECTION TEST"
                    echo "=========================================="

                    set -a
                    . "${APP_DIR}/.env"
                    set +a

                    PGPASSWORD="${PGPASSWORD}" \
                    psql \
                        -h "${PGHOST}" \
                        -U "${PGUSER}" \
                        -d "${PGDATABASE}" \
                        -c "SELECT version();"

                    echo
                    echo "PostgreSQL connection: OK"
                '''
            }
        }

        stage('Database Migration') {
            steps {
                dir("${BACKEND_DIR}") {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        DATABASE MIGRATION"
                        echo "=========================================="

                        set -a
                        . "${APP_DIR}/.env"
                        set +a

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

                    if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
                        echo "Docker network already exists."
                    else
                        docker network create "${NETWORK_NAME}"
                        echo "Docker network created."
                    fi
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

                    mkdir -p "${BACKEND_DIR}"
                    mkdir -p "${FRONTEND_DIR}/nginx"

                    cat > "${BACKEND_DIR}/Dockerfile" <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
EOF

                    cat > "${FRONTEND_DIR}/Dockerfile" <<'EOF'
FROM nginx:alpine

COPY . /usr/share/nginx/html

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

                    cat > "${FRONTEND_DIR}/nginx/default.conf" <<'EOF'
server {

    listen 80;
    listen [::]:80;

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

        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
EOF

                    echo
                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                    echo "Nginx reverse proxy created."
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILDING BACKEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --no-cache \
                        -t "${BACKEND_IMAGE}" \
                        "${BACKEND_DIR}"

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
                    echo "        BUILDING FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --no-cache \
                        -t "${FRONTEND_IMAGE}" \
                        "${FRONTEND_DIR}"

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

                    docker stop "${BACKEND_CONTAINER}" >/dev/null 2>&1 || true
                    docker rm "${BACKEND_CONTAINER}" >/dev/null 2>&1 || true

                    docker stop "${FRONTEND_CONTAINER}" >/dev/null 2>&1 || true
                    docker rm "${FRONTEND_CONTAINER}" >/dev/null 2>&1 || true

                    echo "Old containers removed."
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
                        echo "WARNING: Port ${BACKEND_PORT} is already in use."
                    else
                        echo "Port ${BACKEND_PORT}: available"
                    fi

                    if ss -ltn | grep -q ":${FRONTEND_PORT} "; then
                        echo "WARNING: Port ${FRONTEND_PORT} is already in use."
                    else
                        echo "Port ${FRONTEND_PORT}: available"
                    fi
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
                        --name "${BACKEND_CONTAINER}" \
                        --restart unless-stopped \
                        --network "${NETWORK_NAME}" \
                        --env-file "${APP_DIR}/.env" \
                        -p "${BACKEND_PORT}:${INTERNAL_BACKEND_PORT}" \
                        "${BACKEND_IMAGE}"

                    echo
                    echo "Backend container started."

                    sleep 3

                    docker ps \
                        --filter "name=${BACKEND_CONTAINER}"
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
                        --name "${FRONTEND_CONTAINER}" \
                        --restart unless-stopped \
                        --network "${NETWORK_NAME}" \
                        -p "${FRONTEND_PORT}:80" \
                        "${FRONTEND_IMAGE}"

                    echo
                    echo "Frontend container started."

                    sleep 3

                    docker ps \
                        --filter "name=${FRONTEND_CONTAINER}"
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

                    sleep 5

                    echo
                    echo "Backend status:"
                    docker inspect \
                        --format='{{.State.Status}}' \
                        "${BACKEND_CONTAINER}"

                    echo
                    echo "Frontend status:"
                    docker inspect \
                        --format='{{.State.Status}}' \
                        "${FRONTEND_CONTAINER}"
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

                    success=0

                    for i in 1 2 3 4 5 6 7 8 9 10
                    do
                        echo "Attempt ${i}/10..."

                        if curl -fsS \
                            --max-time 5 \
                            "http://127.0.0.1:${BACKEND_PORT}/" >/tmp/backend-health.txt 2>/dev/null
                        then
                            echo
                            echo "Backend HTTP check: OK"
                            cat /tmp/backend-health.txt
                            success=1
                            break
                        fi

                        sleep 2
                    done

                    if [ "$success" -ne 1 ]; then
                        echo
                        echo "Backend health check failed."
                        docker logs "${BACKEND_CONTAINER}" --tail 100
                        exit 1
                    fi
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

                    curl \
                        -fsS \
                        --max-time 10 \
                        "http://127.0.0.1:${FRONTEND_PORT}/" \
                        >/tmp/frontend.html

                    echo "Frontend HTTP check: OK"

                    grep -qi "<html" /tmp/frontend.html

                    echo "Frontend HTML check: OK"
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

                    echo "Testing frontend -> backend API proxy..."

                    status=$(curl \
                        -s \
                        -o /tmp/api-response.txt \
                        -w "%{http_code}" \
                        --max-time 10 \
                        "http://127.0.0.1:${FRONTEND_PORT}/api/auth/login" \
                        || true)

                    echo "HTTP status: ${status}"

                    if [ "${status}" = "404" ]; then
                        echo
                        echo "ERROR: Nginx API proxy returned 404."
                        cat /tmp/api-response.txt || true
                        exit 1
                    fi

                    echo
                    echo "API proxy is responding."
                '''
            }
        }

        stage('Verify Device Configuration') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VERIFYING DEVICE CONFIGURATION"
                    echo "=========================================="

                    echo "Backend container environment:"

                    docker exec "${BACKEND_CONTAINER}" \
                        sh -c 'if [ -n "$DEVICES" ]; then echo "$DEVICES"; else echo "DEVICES IS EMPTY"; exit 1; fi'

                    echo
                    echo "Device configuration successfully passed to backend."
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
                        --filter "name=${BACKEND_CONTAINER}" \
                        --filter "name=${FRONTEND_CONTAINER}"

                    echo
                    echo "Backend logs:"
                    docker logs "${BACKEND_CONTAINER}" --tail 50

                    echo
                    echo "Frontend logs:"
                    docker logs "${FRONTEND_CONTAINER}" --tail 30
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    set -eu

                    echo
                    echo "===================================================="
                    echo "        DEPLOYMENT SUCCESSFUL"
                    echo "===================================================="

                    echo
                    echo "Application:"
                    echo "eSSL Independent Attendance Monitoring System"

                    echo
                    echo "Frontend:"
                    echo "http://172.16.0.111:${FRONTEND_PORT}/"

                    echo
                    echo "Backend:"
                    echo "http://172.16.0.111:${BACKEND_PORT}/"

                    echo
                    echo "API:"
                    echo "http://172.16.0.111:${BACKEND_PORT}/api"

                    echo
                    echo "Containers:"
                    echo "  ${BACKEND_CONTAINER}"
                    echo "  ${FRONTEND_CONTAINER}"

                    echo
                    echo "Docker network:"
                    echo "  ${NETWORK_NAME}"

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
                    --filter "name=${BACKEND_CONTAINER}" \
                    --filter "name=${FRONTEND_CONTAINER}"
            '''
        }

        failure {
            echo "Jenkins Docker deployment FAILED."

            sh '''
                set +e

                echo
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT FAILED"
                echo "===================================================="

                echo
                echo "Containers:"
                docker ps -a \
                    --filter "name=${BACKEND_CONTAINER}" \
                    --filter "name=${FRONTEND_CONTAINER}"

                echo
                echo "Backend logs:"
                docker logs "${BACKEND_CONTAINER}" --tail 100 2>&1 || true

                echo
                echo "Frontend logs:"
                docker logs "${FRONTEND_CONTAINER}" --tail 100 2>&1 || true

                echo
                echo "Ports:"
                ss -ltnp | grep -E ":${BACKEND_PORT}|:${FRONTEND_PORT}" || true

                echo
                echo "===================================================="
            '''
        }

        always {
            echo "Jenkins Docker deployment process completed."
        }
    }
}
