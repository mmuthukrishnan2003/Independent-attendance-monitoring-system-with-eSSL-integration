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

        APP_ROOT = '/opt/essl-monitor'

        BACKEND_NAME = 'essl-monitor-backend'
        FRONTEND_NAME = 'essl-monitor-frontend'

        BACKEND_IMAGE = 'essl-monitor-backend'
        FRONTEND_IMAGE = 'essl-monitor-frontend'

        DOCKER_NETWORK = 'essl-monitor-network'

        /*
         * IMPORTANT
         *
         * Node application listens inside container on port 5000.
         *
         * Host:
         * 5001
         *
         * Container:
         * 5000
         */
        BACKEND_HOST_PORT = '5001'
        BACKEND_CONTAINER_PORT = '5000'

        /*
         * Nginx listens inside container on port 80.
         *
         * Host:
         * 8081
         *
         * Container:
         * 80
         */
        FRONTEND_HOST_PORT = '8081'
        FRONTEND_CONTAINER_PORT = '80'
    }

    stages {

        stage('Environment Check') {

            steps {

                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        ENVIRONMENT CHECK"
                    echo "=========================================="

                    echo ""
                    echo "Jenkins user:"
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

                    echo ""
                    echo "Backend structure  : OK"
                    echo "Frontend structure : OK"
                    echo "Project validation : OK"
                '''
            }
        }


        stage('Check Environment File') {

            steps {

                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING ENVIRONMENT"
                    echo "=========================================="

                    if [ ! -f "$APP_ROOT/.env" ]; then
                        echo "ERROR: $APP_ROOT/.env does not exist."
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

                    echo ""
                    echo "Database host : $DB_HOST"
                    echo "Database port : $DB_PORT"
                    echo "Database name : $DB_NAME"
                    echo "Database user : $DB_USER"
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
                        echo "        BACKEND VALIDATION"
                        echo "=========================================="

                        npm ci

                        node --check src/server.js
                        node --check src/db/migrate.js

                        echo ""
                        echo "Backend dependencies : OK"
                        echo "Backend syntax       : OK"
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

                    echo ""
                    echo "Database migration completed successfully."
                '''
            }
        }


        stage('Prepare Docker Files') {

            steps {

                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING DOCKER FILES"
                    echo "=========================================="

                    mkdir -p "$APP_ROOT"

                    cat > essl-monitor/backend/Dockerfile <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
EOF


                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

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

                    echo ""
                    echo "Docker network ready:"
                    docker network inspect "$DOCKER_NETWORK" \
                        --format '{{.Name}}'
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
                        -t "$BACKEND_IMAGE:${BUILD_NUMBER}" \
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
                    echo "        BUILDING FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE:${BUILD_NUMBER}" \
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
                    set +e

                    echo "=========================================="
                    echo "        STOPPING OLD CONTAINERS"
                    echo "=========================================="

                    docker rm -f "$BACKEND_NAME" >/dev/null 2>&1 || true
                    docker rm -f "$FRONTEND_NAME" >/dev/null 2>&1 || true

                    echo ""
                    echo "Old application containers removed."
                '''
            }
        }


        stage('Check Required Ports') {

            steps {

                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING REQUIRED PORTS"
                    echo "=========================================="

                    echo ""
                    echo "Checking backend host port $BACKEND_HOST_PORT..."

                    if ss -ltn | grep -q ":${BACKEND_HOST_PORT} "; then

                        echo "ERROR: Port $BACKEND_HOST_PORT is already in use."

                        echo ""
                        echo "Process using port:"
                        sudo ss -ltnp | grep ":${BACKEND_HOST_PORT} " || true

                        exit 1
                    fi

                    echo "Backend port $BACKEND_HOST_PORT is available."

                    echo ""
                    echo "Checking frontend host port $FRONTEND_HOST_PORT..."

                    if ss -ltn | grep -q ":${FRONTEND_HOST_PORT} "; then

                        echo "ERROR: Port $FRONTEND_HOST_PORT is already in use."

                        echo ""
                        echo "Process using port:"
                        sudo ss -ltnp | grep ":${FRONTEND_HOST_PORT} " || true

                        exit 1
                    fi

                    echo "Frontend port $FRONTEND_HOST_PORT is available."

                    echo ""
                    echo "Required ports are available."
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
                        --name "$BACKEND_NAME" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        --env-file "$APP_ROOT/.env" \
                        -p "$BACKEND_HOST_PORT:$BACKEND_CONTAINER_PORT" \
                        "$BACKEND_IMAGE:latest"

                    echo ""
                    echo "Backend container started."

                    docker ps \
                        --filter "name=$BACKEND_NAME"
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
                        --name "$FRONTEND_NAME" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        -p "$FRONTEND_HOST_PORT:$FRONTEND_CONTAINER_PORT" \
                        "$FRONTEND_IMAGE:latest"

                    echo ""
                    echo "Frontend container started."

                    docker ps \
                        --filter "name=$FRONTEND_NAME"
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

                    echo ""
                    echo "Docker containers:"
                    docker ps \
                        --filter "name=$BACKEND_NAME" \
                        --filter "name=$FRONTEND_NAME"
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

                    if ! docker ps \
                        --filter "name=$BACKEND_NAME" \
                        --filter "status=running" \
                        --format '{{.Names}}' | grep -q "^${BACKEND_NAME}$"; then

                        echo "ERROR: Backend container is not running."

                        docker logs "$BACKEND_NAME" --tail 100 || true

                        exit 1
                    fi

                    echo "Backend container is running."

                    echo ""
                    echo "Testing:"
                    echo "http://127.0.0.1:$BACKEND_HOST_PORT/"

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$BACKEND_HOST_PORT/" || true)

                    echo ""
                    echo "Backend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in

                        2*)
                            echo "Backend health check passed."
                            ;;

                        3*)
                            echo "Backend returned redirect."
                            ;;

                        4*)
                            echo "Backend is responding."
                            ;;

                        5*)
                            echo "ERROR: Backend returned HTTP $HTTP_CODE"
                            docker logs "$BACKEND_NAME" --tail 100 || true
                            exit 1
                            ;;

                        000|"")
                            echo "ERROR: Backend is not reachable."
                            docker logs "$BACKEND_NAME" --tail 100 || true
                            exit 1
                            ;;

                        *)
                            echo "ERROR: Unexpected response $HTTP_CODE"
                            docker logs "$BACKEND_NAME" --tail 100 || true
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

                    if ! docker ps \
                        --filter "name=$FRONTEND_NAME" \
                        --filter "status=running" \
                        --format '{{.Names}}' | grep -q "^${FRONTEND_NAME}$"; then

                        echo "ERROR: Frontend container is not running."

                        docker logs "$FRONTEND_NAME" --tail 100 || true

                        exit 1
                    fi

                    echo "Frontend container is running."

                    echo ""
                    echo "Testing:"
                    echo "http://127.0.0.1:$FRONTEND_HOST_PORT/"

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_HOST_PORT/" || true)

                    echo ""
                    echo "Frontend HTTP response: $HTTP_CODE"

                    case "$HTTP_CODE" in

                        2*)
                            echo "Frontend health check passed."
                            ;;

                        3*)
                            echo "Frontend returned redirect."
                            ;;

                        4*)
                            echo "Frontend is responding."
                            ;;

                        5*)
                            echo "ERROR: Frontend returned HTTP $HTTP_CODE"
                            docker logs "$FRONTEND_NAME" --tail 100 || true
                            exit 1
                            ;;

                        000|"")
                            echo "ERROR: Frontend is not reachable."
                            docker logs "$FRONTEND_NAME" --tail 100 || true
                            exit 1
                            ;;

                        *)
                            echo "ERROR: Unexpected response $HTTP_CODE"
                            docker logs "$FRONTEND_NAME" --tail 100 || true
                            exit 1
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
                        --filter "name=$BACKEND_NAME" \
                        --filter "name=$FRONTEND_NAME" \
                        --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"

                    echo ""
                    echo "Backend container:"
                    docker inspect "$BACKEND_NAME" \
                        --format 'Status={{.State.Status}} RestartCount={{.RestartCount}}'

                    echo ""
                    echo "Frontend container:"
                    docker inspect "$FRONTEND_NAME" \
                        --format 'Status={{.State.Status}} RestartCount={{.RestartCount}}'
                '''
            }
        }


        stage('Deployment Information') {

            steps {

                sh '''
                    echo ""
                    echo "=========================================="
                    echo "       DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="

                    echo ""
                    echo "Application      : $APP_NAME"

                    echo ""
                    echo "Backend container:"
                    echo "  Name           : $BACKEND_NAME"
                    echo "  Host port      : $BACKEND_HOST_PORT"
                    echo "  Container port : $BACKEND_CONTAINER_PORT"
                    echo "  API            : http://172.16.0.111:$BACKEND_HOST_PORT"

                    echo ""
                    echo "Frontend container:"
                    echo "  Name           : $FRONTEND_NAME"
                    echo "  Host port      : $FRONTEND_HOST_PORT"
                    echo "  Container port : $FRONTEND_CONTAINER_PORT"
                    echo "  Dashboard      : http://172.16.0.111:$FRONTEND_HOST_PORT"

                    echo ""
                    echo "Docker network   : $DOCKER_NETWORK"

                    echo ""
                    echo "Running containers:"
                    docker ps \
                        --filter "name=$BACKEND_NAME" \
                        --filter "name=$FRONTEND_NAME"

                    echo ""
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

Frontend Dashboard:
http://172.16.0.111:8081

Backend API:
http://172.16.0.111:5001

Backend API:
http://172.16.0.111:5001/api
'''
        }


        failure {

            sh '''
                echo ""
                echo "=========================================="
                echo "       DOCKER DEPLOYMENT FAILED"
                echo "=========================================="

                echo ""
                echo "All application containers:"
                docker ps -a \
                    --filter "name=$BACKEND_NAME" \
                    --filter "name=$FRONTEND_NAME" || true

                echo ""
                echo "=========================================="
                echo "BACKEND LOGS"
                echo "=========================================="

                docker logs "$BACKEND_NAME" \
                    --tail 100 2>/dev/null || true

                echo ""
                echo "=========================================="
                echo "FRONTEND LOGS"
                echo "=========================================="

                docker logs "$FRONTEND_NAME" \
                    --tail 100 2>/dev/null || true

                echo ""
                echo "=========================================="
                echo "PORT INFORMATION"
                echo "=========================================="

                sudo ss -ltnp | grep -E ':5001 |:8081 ' || true

                echo ""
                echo "=========================================="
            '''
        }


        always {

            echo "Jenkins Docker deployment process completed."
        }
    }
}
