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
        APP_NAME        = 'essl-monitor'
        APP_ROOT        = '/opt/essl-monitor'
        BACKEND_IMAGE   = 'essl-monitor-backend'
        FRONTEND_IMAGE  = 'essl-monitor-frontend'

        BACKEND_CONTAINER  = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        BACKEND_PORT = '5001'
        FRONTEND_PORT = '8080'

        DOCKER_NETWORK = 'essl-monitor-network'
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
                    docker compose version || true

                    echo ""
                    echo "PostgreSQL:"
                    psql --version

                    echo ""
                    echo "Docker access:"
                    docker ps
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

        stage('Prepare Docker Files') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       PREPARING DOCKER FILES"
                    echo "=========================================="

                    mkdir -p "$APP_ROOT"

                    cat > essl-monitor/backend/Dockerfile <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5001

CMD ["node", "src/server.js"]
EOF

                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

ENV TZ=Asia/Kolkata

COPY . /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

                    echo ""
                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                '''
            }
        }

        stage('Prepare Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       CHECKING APPLICATION ENV"
                    echo "=========================================="

                    if [ ! -f "$APP_ROOT/.env" ]; then
                        echo "ERROR: $APP_ROOT/.env does not exist."
                        echo ""
                        echo "Create it first:"
                        echo "sudo nano $APP_ROOT/.env"
                        exit 1
                    fi

                    echo ".env found."

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

                    : "${DB_HOST:?DB_HOST missing}"
                    : "${DB_PORT:?DB_PORT missing}"
                    : "${DB_NAME:?DB_NAME missing}"
                    : "${DB_USER:?DB_USER missing}"
                    : "${DB_PASSWORD:?DB_PASSWORD missing}"

                    echo "Database host : $DB_HOST"
                    echo "Database port : $DB_PORT"
                    echo "Database name : $DB_NAME"
                    echo "Database user : $DB_USER"
                    echo "Database password : configured"

                    echo "Environment configuration OK."
                '''
            }
        }

        stage('Backend Dependency Test') {
            steps {
                dir('essl-monitor/backend') {
                    sh '''
                        set -eu

                        echo "Installing backend dependencies for validation..."

                        npm ci

                        echo "Backend dependencies installed."

                        node --check src/server.js
                        node --check src/db/migrate.js

                        echo "Backend JavaScript syntax OK."
                    '''
                }
            }
        }

        stage('Test PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

                    PGPASSWORD="$DB_PASSWORD" \
                    psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database(), current_user;"

                    echo "PostgreSQL connection successful."
                '''
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       DATABASE MIGRATION"
                    echo "=========================================="

                    cd essl-monitor/backend

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

                    export DATABASE_HOST="$DB_HOST"
                    export DATABASE_PORT="$DB_PORT"
                    export DATABASE_NAME="$DB_NAME"
                    export DATABASE_USER="$DB_USER"
                    export DATABASE_PASSWORD="$DB_PASSWORD"

                    export PGHOST="$DB_HOST"
                    export PGPORT="$DB_PORT"
                    export PGDATABASE="$DB_NAME"
                    export PGUSER="$DB_USER"
                    export PGPASSWORD="$DB_PASSWORD"

                    node src/db/migrate.js

                    echo "Database migration completed."
                '''
            }
        }

        stage('Create Docker Network') {
            steps {
                sh '''
                    set -eu

                    if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
                        echo "Creating Docker network..."
                        docker network create "$DOCKER_NETWORK"
                    else
                        echo "Docker network already exists."
                    fi
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       BUILDING BACKEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$BACKEND_IMAGE:$BUILD_NUMBER" \
                        -t "$BACKEND_IMAGE:latest" \
                        essl-monitor/backend

                    echo "Backend image built successfully."
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       BUILDING FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE:$BUILD_NUMBER" \
                        -t "$FRONTEND_IMAGE:latest" \
                        essl-monitor/frontend

                    echo "Frontend image built successfully."
                '''
            }
        }

        stage('Stop Old Containers') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       STOPPING OLD CONTAINERS"
                    echo "=========================================="

                    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
                    docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null || true

                    echo "Old containers removed."
                '''
            }
        }

        stage('Start Backend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       STARTING BACKEND CONTAINER"
                    echo "=========================================="

                    docker run -d \
                        --name "$BACKEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        --env-file "$APP_ROOT/.env" \
                        -p "$BACKEND_PORT:5001" \
                        "$BACKEND_IMAGE:latest"

                    echo "Backend container started."
                '''
            }
        }

        stage('Start Frontend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       STARTING FRONTEND CONTAINER"
                    echo "=========================================="

                    docker run -d \
                        --name "$FRONTEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        -p "$FRONTEND_PORT:80" \
                        "$FRONTEND_IMAGE:latest"

                    echo "Frontend container started."
                '''
            }
        }

        stage('Wait For Containers') {
            steps {
                sh '''
                    set -eu

                    echo "Waiting for containers..."

                    sleep 10

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"
                '''
            }
        }

        stage('Backend Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "       BACKEND HEALTH CHECK"
                    echo "=========================================="

                    if ! docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then
                        echo "ERROR: Backend container is not running."
                        docker logs "$BACKEND_CONTAINER" --tail 100 || true
                        exit 1
                    fi

                    echo "Backend container is running."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$BACKEND_PORT/")

                    echo "Backend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*|4*)
                            echo "Backend is responding."
                            ;;
                        *)
                            echo "ERROR: Backend is not responding."
                            docker logs "$BACKEND_CONTAINER" --tail 100 || true
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
                    echo "       FRONTEND HEALTH CHECK"
                    echo "=========================================="

                    if ! docker ps --format '{{.Names}}' | grep -qx "$FRONTEND_CONTAINER"; then
                        echo "ERROR: Frontend container is not running."
                        docker logs "$FRONTEND_CONTAINER" --tail 100 || true
                        exit 1
                    fi

                    echo "Frontend container is running."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_PORT/")

                    echo "Frontend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*)
                            echo "Frontend is responding."
                            ;;
                        *)
                            echo "ERROR: Frontend is not responding."
                            docker logs "$FRONTEND_CONTAINER" --tail 100 || true
                            exit 1
                            ;;
                    esac
                '''
            }
        }

        stage('Container Status') {
            steps {
                sh '''
                    echo "=========================================="
                    echo "       CONTAINER STATUS"
                    echo "=========================================="

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER" \
                        --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

                    echo ""
                    echo "Backend logs:"
                    docker logs "$BACKEND_CONTAINER" --tail 30 || true

                    echo ""
                    echo "Frontend logs:"
                    docker logs "$FRONTEND_CONTAINER" --tail 30 || true
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo ""
                    echo "=============================================="
                    echo "       DEPLOYMENT SUCCESSFUL"
                    echo "=============================================="

                    echo ""
                    echo "Application : eSSL Attendance Monitor"

                    echo ""
                    echo "Frontend:"
                    echo "http://172.16.0.111:8080"

                    echo ""
                    echo "Backend:"
                    echo "http://172.16.0.111:5001"

                    echo ""
                    echo "Backend container:"
                    echo "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend container:"
                    echo "$FRONTEND_CONTAINER"

                    echo ""
                    echo "Docker images:"
                    docker images | grep essl-monitor || true

                    echo ""
                    echo "Running containers:"
                    docker ps
                '''
            }
        }
    }

    post {

        success {
            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DOCKER DEPLOYMENT SUCCESSFUL
==============================================

Frontend:
http://172.16.0.111:8080

Backend:
http://172.16.0.111:5001
'''
        }

        failure {
            sh '''
                echo "=========================================="
                echo "       DOCKER DEPLOYMENT FAILED"
                echo "=========================================="

                echo ""
                echo "Containers:"
                docker ps -a \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER" || true

                echo ""
                echo "Backend logs:"
                docker logs "$BACKEND_CONTAINER" --tail 100 2>/dev/null || true

                echo ""
                echo "Frontend logs:"
                docker logs "$FRONTEND_CONTAINER" --tail 100 2>/dev/null || true
            '''
        }

        always {
            echo "Jenkins Docker deployment process completed."
        }
    }
}
