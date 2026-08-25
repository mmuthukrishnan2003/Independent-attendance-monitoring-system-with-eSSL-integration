pipeline {
    agent any

    environment {
        APP_NAME = 'essl-attendance-monitor'
        APP_DIR = '/opt/essl-monitor/current'
        ENV_FILE = '/opt/essl-monitor/.env'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -e
                    node -v
                    npm -v
                    git --version
                    psql --version
                    pm2 -v
                    echo "Environment OK"
                '''
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -e

                    test -d essl-monitor/backend
                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/src/server.js

                    echo "Project structure OK"
                '''
            }
        }

        stage('Check Database Configuration') {
            steps {
                sh '''
                    set -e

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE not found"
                        exit 1
                    fi

                    set -a
                    . "$ENV_FILE"
                    set +a

                    echo "Database configuration:"
                    echo "Host: $DB_HOST"
                    echo "Port: $DB_PORT"
                    echo "Database: $DB_NAME"
                    echo "User: $DB_USER"

                    if [ -z "$DB_PASSWORD" ]; then
                        echo "ERROR: DB_PASSWORD is empty"
                        exit 1
                    fi

                    echo "Database configuration OK"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    cd essl-monitor/backend

                    npm ci

                    echo "Dependencies installed"
                '''
            }
        }

        stage('Prepare Application') {
            steps {
                sh '''
                    set -e

                    rm -rf "$APP_DIR"
                    mkdir -p "$APP_DIR/src/db"

                    cp essl-monitor/backend/package.json "$APP_DIR/"
                    cp essl-monitor/backend/package-lock.json "$APP_DIR/"
                    cp -r essl-monitor/backend/src/* "$APP_DIR/src/"

                    cp "$ENV_FILE" "$APP_DIR/.env"

                    echo "Application copied"
                '''
            }
        }

        stage('Install Production Dependencies') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    npm ci --omit=dev

                    echo "Production dependencies installed"
                '''
            }
        }

        stage('Create Migration File') {
            steps {
                sh '''
                    set -e

                    mkdir -p "$APP_DIR/src/db"

                    cat > "$APP_DIR/src/db/migrate.js" <<'NODEEOF'
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = String(process.env.DB_PASSWORD || '');

console.log('');
console.log('======================================');
console.log(' eSSL Attendance Database Migration');
console.log('======================================');
console.log('Host:     ' + DB_HOST);
console.log('Port:     ' + DB_PORT);
console.log('Database: ' + DB_NAME);
console.log('User:     ' + DB_USER);
console.log('Password: ' + (DB_PASSWORD ? 'configured' : 'MISSING'));
console.log('======================================');

if (!DB_NAME) {
    console.error('[Migrate] DB_NAME is missing');
    process.exit(1);
}

if (!DB_USER) {
    console.error('[Migrate] DB_USER is missing');
    process.exit(1);
}

if (!DB_PASSWORD) {
    console.error('[Migrate] DB_PASSWORD is missing');
    process.exit(1);
}

const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD
});

const schema = `
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(100) UNIQUE NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    designation VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    device_user_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    model VARCHAR(100),
    ip_address VARCHAR(100) NOT NULL,
    port INTEGER DEFAULT 4370,
    serial_number VARCHAR(255),
    firmware_version VARCHAR(255),
    device_role VARCHAR(20) DEFAULT 'NONE',
    status VARCHAR(20) DEFAULT 'offline',
    last_communication TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    device_user_id VARCHAR(100),
    punch_time TIMESTAMP NOT NULL,
    punch_type VARCHAR(20) DEFAULT 'NONE',
    verification_type VARCHAR(50),
    work_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee
ON attendance(employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_punch_time
ON attendance(punch_time);

CREATE INDEX IF NOT EXISTS idx_attendance_work_date
ON attendance(work_date);

CREATE INDEX IF NOT EXISTS idx_attendance_device
ON attendance(device_id);

CREATE INDEX IF NOT EXISTS idx_employees_status
ON employees(status);

CREATE INDEX IF NOT EXISTS idx_devices_status
ON devices(status);
`;

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('');
        console.log('[Migrate] Connecting to PostgreSQL...');

        await client.query('SELECT 1');

        console.log('[Migrate] PostgreSQL connection established.');
        console.log('[Migrate] Applying database schema...');

        await client.query('BEGIN');

        await client.query(schema);

        await client.query('COMMIT');

        console.log('[Migrate] Database schema applied successfully.');
        console.log('[Migrate] Migration completed.');

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}

        console.error('[Migrate] Migration failed:');
        console.error(error.message);

        process.exitCode = 1;

    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
NODEEOF

                    chmod 644 "$APP_DIR/src/db/migrate.js"

                    echo "Migration file created successfully"

                    node --check "$APP_DIR/src/db/migrate.js"
                '''
            }
        }

        stage('Test Database Connection') {
            steps {
                sh '''
                    set -e

                    set -a
                    . "$ENV_FILE"
                    set +a

                    echo "Testing PostgreSQL connection..."

                    PGPASSWORD="$DB_PASSWORD" \
                    psql \
                    -h "$DB_HOST" \
                    -p "$DB_PORT" \
                    -U "$DB_USER" \
                    -d "$DB_NAME" \
                    -c "SELECT current_database(), current_user;"

                    echo "PostgreSQL connection successful"
                '''
            }
        }

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Running database migration..."

                    set -a
                    . "$ENV_FILE"
                    set +a

                    node src/db/migrate.js

                    echo "Database migration successful"
                '''
            }
        }

        stage('Application Test') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    node --check src/server.js

                    echo "Application syntax check successful"
                '''
            }
        }

        stage('Start Application') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --update-env

                    pm2 save

                    echo "Application started"

                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    sleep 5

                    pm2 describe "$APP_NAME"

                    echo ""
                    echo "======================================"
                    echo "DEPLOYMENT SUCCESSFUL"
                    echo "======================================"
                    echo "Dashboard:"
                    echo "http://172.16.0.111:5001/"
                    echo "======================================"
                '''
            }
        }
    }

    post {
        success {
            echo '''
========================================
 eSSL Attendance Monitor
 DEPLOYMENT SUCCESS
========================================
Dashboard:
http://172.16.0.111:5001/
========================================
'''
        }

        failure {
            echo '''
========================================
 eSSL Attendance Monitor
 DEPLOYMENT FAILED
========================================
Check the failed Jenkins stage.
========================================
'''
        }
    }
}
