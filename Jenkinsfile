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

        BACKEND_IMAGE = 'essl-monitor-backend'
        FRONTEND_IMAGE = 'essl-monitor-frontend'

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        DOCKER_NETWORK = 'essl-monitor-network'

        BACKEND_HOST_PORT = '5001'
        BACKEND_CONTAINER_PORT = '5000'

        FRONTEND_HOST_PORT = '8080'
        FRONTEND_CONTAINER_PORT = '80'

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


        stage('Prepare Dockerfiles') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING DOCKERFILES"
                    echo "=========================================="

                    mkdir -p essl-monitor/backend
                    mkdir -p essl-monitor/frontend

                    cat > essl-monitor/backend/Dockerfile <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]
EOF

                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

COPY . /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                '''
            }
        }


        stage('Prepare Backend Environment') {
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

                    : "${PGHOST:?PGHOST missing}"
                    : "${PGUSER:?PGUSER missing}"
                    : "${PGPASSWORD:?PGPASSWORD missing}"
                    : "${PGDATABASE:?PGDATABASE missing}"

                    echo
                    echo "Database host     : $PGHOST"
                    echo "Database port     : ${PGPORT:-5432}"
                    echo "Database name     : $PGDATABASE"
                    echo "Database user     : $PGUSER"
                    echo "Database password : configured"

                    echo
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

                        echo
                        echo "Backend dependencies installed."
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
                    echo "        POSTGRESQL CONNECTION TEST"
                    echo "=========================================="

                    set +x
                    set -a
                    . "$ENV_FILE"
                    set +a
                    set -x

                    PGPASSWORD="$PGPASSWORD" \
                    psql \
                        -h "$PGHOST" \
                        -p "${PGPORT:-5432}" \
                        -U "$PGUSER" \
                        -d "$PGDATABASE" \
                        -c "SELECT current_database(), current_user;"

                    echo
                    echo "PostgreSQL connection successful."
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

                        set +x
                        set -a
                        . "$ENV_FILE"
                        set +a
                        set -x

                        export DATABASE_HOST="$PGHOST"
                        export DATABASE_PORT="${PGPORT:-5432}"
                        export DATABASE_NAME="$PGDATABASE"
                        export DATABASE_USER="$PGUSER"
                        export DATABASE_PASSWORD="$PGPASSWORD"

                        export PGHOST="$PGHOST"
                        export PGPORT="${PGPORT:-5432}"
                        export PGDATABASE="$PGDATABASE"
                        export PGUSER="$PGUSER"
                        export PGPASSWORD="$PGPASSWORD"

                        node src/db/migrate.js

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

                    if docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
                        echo "Docker network already exists."
                    else
                        echo "Creating Docker network..."
                        docker network create "$DOCKER_NETWORK"
                    fi

                    echo "Docker network ready."
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
                        --pull \
                        -t "$BACKEND_IMAGE:$BUILD_NUMBER" \
                        -t "$BACKEND_IMAGE:latest" \
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
                    echo "        BUILDING FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE:$BUILD_NUMBER" \
                        -t "$FRONTEND_IMAGE:latest" \
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

                    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null
                    docker rm -f "$FRONTEND_CONTAINER" 2>/dev/null

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

                    echo
                    echo "Checking backend host port $BACKEND_HOST_PORT..."

                    if ss -ltn | grep -q ":$BACKEND_HOST_PORT "; then
                        echo "ERROR: Port $BACKEND_HOST_PORT is already in use."
                        ss -ltnp | grep ":$BACKEND_HOST_PORT " || true
                        exit 1
                    fi

                    echo "Backend port $BACKEND_HOST_PORT is available."

                    echo
                    echo "Checking frontend host port $FRONTEND_HOST_PORT..."

                    if ss -ltn | grep -q ":$FRONTEND_HOST_PORT "; then
                        echo "ERROR: Port $FRONTEND_HOST_PORT is already in use."
                        ss -ltnp | grep ":$FRONTEND_HOST_PORT " || true
                        exit 1
                    fi

                    echo "Frontend port $FRONTEND_HOST_PORT is available."
                '''
            }
        }


        stage('Start Backend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING BACKEND CONTAINER"
                    echo "=========================================="

                    docker run -d \
                        --name "$BACKEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        --add-host=host.docker.internal:host-gateway \
                        --env-file "$ENV_FILE" \
                        -e PORT="$BACKEND_CONTAINER_PORT" \
                        -e PGHOST=host.docker.internal \
                        -p "$BACKEND_HOST_PORT:$BACKEND_CONTAINER_PORT" \
                        "$BACKEND_IMAGE:latest"

                    echo
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
                    echo "        STARTING FRONTEND CONTAINER"
                    echo "=========================================="

                    docker run -d \
                        --name "$FRONTEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        -p "$FRONTEND_HOST_PORT:$FRONTEND_CONTAINER_PORT" \
                        "$FRONTEND_IMAGE:latest"

                    echo
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

                    echo
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

                    if ! docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then

                        echo "ERROR: Backend container is not running."

                        docker logs "$BACKEND_CONTAINER" --tail 100 || true

                        exit 1
                    fi

                    echo
                    echo "Backend container is running."

                    echo
                    echo "Backend logs:"
                    docker logs "$BACKEND_CONTAINER" --tail 50

                    echo
                    echo "Checking HTTP port $BACKEND_HOST_PORT..."

                    HTTP_CODE="000"

                    for i in 1 2 3 4 5 6 7 8 9 10
                    do

                        HTTP_CODE=$(curl \
                            -s \
                            -o /dev/null \
                            -w "%{http_code}" \
                            --connect-timeout 3 \
                            --max-time 5 \
                            "http://127.0.0.1:$BACKEND_HOST_PORT/" || true)

                        if [ "$HTTP_CODE" != "000" ]; then
                            break
                        fi

                        sleep 2

                    done

                    echo "Backend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*|4*)
                            echo "Backend health check passed."
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
                    echo "        FRONTEND HEALTH CHECK"
                    echo "=========================================="

                    if ! docker ps --format '{{.Names}}' | grep -qx "$FRONTEND_CONTAINER"; then

                        echo "ERROR: Frontend container is not running."

                        docker logs "$FRONTEND_CONTAINER" --tail 100 || true

                        exit 1
                    fi

                    echo "Frontend container is running."

                    HTTP_CODE="000"

                    for i in 1 2 3 4 5 6 7 8 9 10
                    do

                        HTTP_CODE=$(curl \
                            -s \
                            -o /dev/null \
                            -w "%{http_code}" \
                            --connect-timeout 3 \
                            --max-time 5 \
                            "http://127.0.0.1:$FRONTEND_HOST_PORT/" || true)

                        if [ "$HTTP_CODE" != "000" ]; then
                            break
                        fi

                        sleep 2

                    done

                    echo "Frontend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in
                        2*|3*|4*)
                            echo "Frontend health check passed."
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
                    echo "        CONTAINER STATUS"
                    echo "=========================================="

                    docker ps -a \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"

                    echo
                    echo "Backend port:"
                    docker port "$BACKEND_CONTAINER" || true

                    echo
                    echo "Frontend port:"
                    docker port "$FRONTEND_CONTAINER" || true

                    echo
                    echo "Docker network:"
                    docker network inspect "$DOCKER_NETWORK" \
                        --format '{{json .Containers}}' || true
                '''
            }
        }


        stage('Deployment Information') {
            steps {
                sh '''
                    echo
                    echo "=========================================="
                    echo "       DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="

                    echo
                    echo "Application : $APP_NAME"

                    echo
                    echo "Backend:"
                    echo "  Container : $BACKEND_CONTAINER"
                    echo "  Host Port : $BACKEND_HOST_PORT"
                    echo "  App Port  : $BACKEND_CONTAINER_PORT"
                    echo "  URL       : http://$SERVER_IP:$BACKEND_HOST_PORT"

                    echo
                    echo "Frontend:"
                    echo "  Container : $FRONTEND_CONTAINER"
                    echo "  Host Port : $FRONTEND_HOST_PORT"
                    echo "  Container : $FRONTEND_CONTAINER_PORT"
                    echo "  URL       : http://$SERVER_IP:$FRONTEND_HOST_PORT"

                    echo
                    echo "PostgreSQL:"
                    echo "  Host      : host.docker.internal"
                    echo "  Port      : 5432"

                    echo
                    echo "Containers:"
                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"

                    echo
                    echo "=========================================="
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

Backend API:
http://172.16.0.111:5001/api
==============================================
'''
        }

        failure {
            sh '''
                echo
                echo "=========================================="
                echo "       DOCKER DEPLOYMENT FAILED"
                echo "=========================================="

                echo
                echo "All relevant containers:"
                docker ps -a \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER" || true

                echo
                echo "Backend logs:"
                docker logs "$BACKEND_CONTAINER" --tail 100 2>/dev/null || true

                echo
                echo "Frontend logs:"
                docker logs "$FRONTEND_CONTAINER" --tail 100 2>/dev/null || true

                echo
                echo "Port 5001:"
                ss -ltnp | grep ':5001 ' || true

                echo
                echo "Port 8080:"
                ss -ltnp | grep ':8080 ' || true

                echo
                echo "=========================================="
            '''
        }

        always {
            echo "Jenkins Docker deployment process completed."
        }
    }
}
