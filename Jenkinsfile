pipeline {
    agent any

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        BACKEND_DIR = '/opt/essl-monitor/backend'
        NODE_ENV = 'production'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Check Node.js') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('backend') {
                    sh '''
                        npm ci
                    '''
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh '''
                        if npm run | grep -q "test"; then
                            npm test
                        else
                            echo "No test script found. Skipping tests."
                        fi
                    '''
                }
            }
        }

        stage('Database Migration') {
            steps {
                dir('backend') {
                    sh '''
                        npm run migrate
                    '''
                }
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                    sudo mkdir -p ${APP_DIR}

                    sudo rsync -av --delete \
                        --exclude='.git' \
                        --exclude='node_modules' \
                        --exclude='.env' \
                        ./ ${APP_DIR}/

                    cd ${BACKEND_DIR}

                    npm ci --omit=dev

                    if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
                        pm2 restart ${APP_NAME}
                    else
                        pm2 start src/server.js --name ${APP_NAME}
                    fi

                    pm2 save
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    sleep 5

                    curl -f http://127.0.0.1:5000/ || exit 1

                    echo "Application is running successfully."
                '''
            }
        }
    }

    post {
        success {
            echo '======================================'
            echo ' eSSL Monitor Deployment Successful'
            echo '======================================'
            echo 'Dashboard: http://172.16.0.111:5001/'
        }

        failure {
            echo '======================================'
            echo ' eSSL Monitor Deployment FAILED'
            echo '======================================'
            echo 'Check Jenkins console output.'
        }
    }
}
