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

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        DOCKER_NETWORK = 'essl-monitor-network'

        BACKEND_IMAGE = 'essl-monitor-backend'
        FRONTEND_IMAGE = 'essl-monitor-frontend'

        BACKEND_INTERNAL_PORT = '5000'

        /*
         * IMPORTANT:
         *
         * Backend:
         * Host 5001 -> Container 5000
         *
         * Frontend:
         * Host 8081 -> Container 80
         *
         * Port 8080 is already used by Jenkins.
         */
        BACKEND_HOST_PORT = '5001'
        FRONTEND_HOST_PORT = '8081'

        APP_ROOT = '/opt/essl-monitor'
        ENV_FILE = '/opt/essl-monitor/.env'

        SERVER_IP = '172.16.0.111'
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

COPY src ./src

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "src/server.js"]
EOF


                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF


                    cat > essl-monitor/frontend/nginx.conf <<'EOF'
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
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
EOF


                    echo ""
                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                    echo "Nginx reverse proxy created."
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

                    set +x
                    set -a
                    . "$ENV_FILE"
                    set +a
                    set -x

                    /*
                     * Do NOT require PGHOST.
                     *
                     * Your README uses PGHOST/PGUSER/etc.,
                     * but the current application can also use
                     * DB_* variables.
                     *
                     * We create compatible variables below.
                     */

                    if [ -z "${PGHOST:-}" ]; then
                        export PGHOST="${DB_HOST:-172.16.0.111}"
                    fi

                    if [ -z "${PGPORT:-}" ]; then
                        export PGPORT="${DB_PORT:-5432}"
                    fi

                    if [ -z "${PGDATABASE:-}" ]; then
                        export PGDATABASE="${DB_NAME:-essl_monitor}"
                    fi

                    if [ -z "${PGUSER:-}" ]; then
                        export PGUSER="${DB_USER:-postgres}"
                    fi

                    if [ -z "${PGPASSWORD:-}" ]; then
                        export PGPASSWORD="${DB_PASSWORD:-demo}"
                    fi

                    echo ""
                    echo "Database host     : $PGHOST"
                    echo "Database port     : $PGPORT"
                    echo "Database name     : $PGDATABASE"
                    echo "Database user     : $PGUSER"
                    echo "Database password : configured"

                    echo ""
                    echo "Environment configuration OK."
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

                        node --check src/server.js
                        node --check src/db/migrate.js

                        echo ""
                        echo "Backend JavaScript syntax OK."
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

                    set +x
                    set -a
                    . "$ENV_FILE"
                    set +a
                    set -x

                    DB_HOST="${DB_HOST:-172.16.0.111}"
                    DB_PORT="${DB_PORT:-5432}"
                    DB_NAME="${DB_NAME:-essl_monitor}"
                    DB_USER="${DB_USER:-postgres}"
                    DB_PASSWORD="${DB_PASSWORD:-demo}"

                    PGPASSWORD="$DB_PASSWORD" \
                    psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database(), current_user;"

                    echo ""
                    echo "PostgreSQL connection successful."
                '''
            }
        }


        stage('Database Migration') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DATABASE MIGRATION"
                    echo "=========================================="

                    cd essl-monitor/backend

                    set +x
                    set -a
                    . "$ENV_FILE"
                    set +a
                    set -x

                    export PGHOST="${PGHOST:-${DB_HOST:-172.16.0.111}}"
                    export PGPORT="${PGPORT:-${DB_PORT:-5432}}"
                    export PGDATABASE="${PGDATABASE:-${DB_NAME:-essl_monitor}}"
                    export PGUSER="${PGUSER:-${DB_USER:-postgres}}"
                    export PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-demo}}"

                    export DATABASE_HOST="$PGHOST"
                    export DATABASE_PORT="$PGPORT"
                    export DATABASE_NAME="$PGDATABASE"
                    export DATABASE_USER="$PGUSER"
                    export DATABASE_PASSWORD="$PGPASSWORD"

                    node src/db/migrate.js

                    echo ""
                    echo "Database migration completed."
                '''
            }
        }


        stage('Create Docker Network') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DOCKER NETWORK"
                    echo "=========================================="

                    if docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then

                        echo "Docker network already exists."

                    else

                        echo "Creating Docker network..."

                        docker network create "$DOCKER_NETWORK"

                    fi
                '''
            }
        }


        stage('Build Backend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILDING BACKEND"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$BACKEND_IMAGE:$BUILD_NUMBER" \
                        -t "$BACKEND_IMAGE:latest" \
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
                    echo "        BUILDING FRONTEND"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE:$BUILD_NUMBER" \
                        -t "$FRONTEND_IMAGE:latest" \
                        essl-monitor/frontend

                    echo ""
                    echo "Frontend image built successfully."
                '''
            }
        }


        stage('Stop Old Containers') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STOPPING OLD CONTAINERS"
                    echo "=========================================="

                    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
                    docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true

                    echo ""
                    echo "Old application containers removed."
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

                    echo ""
                    echo "Port $BACKEND_HOST_PORT:"

                    if ss -ltn | grep -q ":$BACKEND_HOST_PORT "; then
                        echo "ERROR: Port $BACKEND_HOST_PORT is already in use."

                        ss -ltnp | grep ":$BACKEND_HOST_PORT " || true

                        exit 1
                    else
                        echo "Port $BACKEND_HOST_PORT is available."
                    fi


                    echo ""
                    echo "Port $FRONTEND_HOST_PORT:"

                    if ss -ltn | grep -q ":$FRONTEND_HOST_PORT "; then
                        echo "ERROR: Port $FRONTEND_HOST_PORT is already in use."

                        ss -ltnp | grep ":$FRONTEND_HOST_PORT " || true

                        exit 1
                    else
                        echo "Port $FRONTEND_HOST_PORT is available."
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
                        --name "$BACKEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        --env-file "$ENV_FILE" \
                        -p "$BACKEND_HOST_PORT:$BACKEND_INTERNAL_PORT" \
                        "$BACKEND_IMAGE:latest"

                    echo ""
                    echo "Backend container started."

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER"
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
                        -p "$FRONTEND_HOST_PORT:80" \
                        "$FRONTEND_IMAGE:latest"

                    echo ""
                    echo "Frontend container started."

                    docker ps \
                        --filter "name=$FRONTEND_CONTAINER"
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

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"

                    echo ""
                    echo "Container startup completed."
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

                    echo "Checking backend container..."

                    docker inspect \
                        --format='{{.State.Status}}' \
                        "$BACKEND_CONTAINER"

                    echo ""
                    echo "Checking port $BACKEND_HOST_PORT..."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$BACKEND_HOST_PORT/")

                    echo "Backend HTTP code: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*|4*)
                            echo "Backend is responding."
                            ;;
                        *)
                            echo "ERROR: Backend health check failed."

                            docker logs "$BACKEND_CONTAINER" \
                                --tail 100 || true

                            exit 1
                            ;;
                    esac
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

                    echo "Checking frontend..."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_HOST_PORT/")

                    echo "Frontend HTTP code: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*)
                            echo "Frontend is responding."
                            ;;
                        *)
                            echo "ERROR: Frontend health check failed."

                            docker logs "$FRONTEND_CONTAINER" \
                                --tail 100 || true

                            exit 1
                            ;;
                    esac
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

                    echo "Testing frontend -> backend proxy."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_HOST_PORT/api/")

                    echo "API proxy HTTP code: $HTTP_CODE"

                    /*
                     * 404 is acceptable here if /api/ itself is not
                     * implemented by the backend.
                     *
                     * The important part is that Nginx reaches the
                     * backend instead of returning its own 404.
                     */

                    case "$HTTP_CODE" in
                        2*|3*|4*)
                            echo "Frontend API proxy is working."
                            ;;
                        5*|000)
                            echo "ERROR: Frontend cannot reach backend."

                            docker logs "$FRONTEND_CONTAINER" \
                                --tail 100 || true

                            exit 1
                            ;;
                        *)
                            echo "API proxy responded with HTTP $HTTP_CODE."
                            ;;
                    esac
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
                        --format='Status={{.State.Status}} Restart={{.RestartCount}}' \
                        "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend:"
                    docker inspect \
                        --format='Status={{.State.Status}} Restart={{.RestartCount}}' \
                        "$FRONTEND_CONTAINER"
                '''
            }
        }


        stage('Deployment Information') {
            steps {
                sh '''
                    echo "=========================================="
                    echo "       DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="

                    echo ""

                    echo "Application:"
                    echo "$APP_NAME"

                    echo ""
                    echo "Backend:"
                    echo "http://$SERVER_IP:$BACKEND_HOST_PORT"

                    echo ""
                    echo "Frontend:"
                    echo "http://$SERVER_IP:$FRONTEND_HOST_PORT"

                    echo ""
                    echo "Dashboard:"
                    echo "http://$SERVER_IP:$FRONTEND_HOST_PORT"

                    echo ""
                    echo "Backend container:"
                    echo "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend container:"
                    echo "$FRONTEND_CONTAINER"

                    echo ""
                    echo "Docker network:"
                    echo "$DOCKER_NETWORK"

                    echo ""
                    echo "=========================================="

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"
                '''
            }
        }
    }


    post {

        success {

            echo '''
====================================================
        eSSL ATTENDANCE MONITOR
        DOCKER DEPLOYMENT SUCCESSFUL
====================================================

Frontend:
http://172.16.0.111:8081

Backend:
http://172.16.0.111:5001

Dashboard:
http://172.16.0.111:8081

Containers:
essl-monitor-backend
essl-monitor-frontend

====================================================
'''
        }


        failure {

            sh '''
                echo ""
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT FAILED"
                echo "===================================================="

                echo ""
                echo "Containers:"

                docker ps -a \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER" \
                    || true

                echo ""
                echo "Backend logs:"

                docker logs "$BACKEND_CONTAINER" \
                    --tail 100 \
                    2>/dev/null || true

                echo ""
                echo "Frontend logs:"

                docker logs "$FRONTEND_CONTAINER" \
                    --tail 100 \
                    2>/dev/null || true

                echo ""
                echo "Port $BACKEND_HOST_PORT:"

                ss -ltnp | grep ":$BACKEND_HOST_PORT " \
                    || true

                echo ""
                echo "Port $FRONTEND_HOST_PORT:"

                ss -ltnp | grep ":$FRONTEND_HOST_PORT " \
                    || true

                echo ""
                echo "===================================================="
            '''
        }


        always {

            echo "Jenkins Docker deployment process completed."

        }
    }
}
