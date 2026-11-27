pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo '=== [Stage 1: Checkout] Pulling backend repository from Git ==='
                checkout scm
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo '=== [Stage 2: Deploy] Executing zero-downtime deployment on EC2 via SSH ==='
                bat 'ssh -o StrictHostKeyChecking=no -i "%EC2_SSH_KEY_PATH%" %EC2_USER%@%EC2_HOST% "cd ~/cloudtask-backend && git pull origin main && npm install --omit=dev && pm2 reload cloudtask-api --update-env"'
            }
        }

        stage('Verify Health') {
            steps {
                echo '=== [Stage 3: Verify] Checking live service health ==='
                bat 'curl -f http://%EC2_HOST%/health'
            }
        }
    }

    post {
        success {
            echo '=== Jenkins Backend Pipeline Completed Successfully! ==='
        }
        failure {
            echo '=== Jenkins Backend Pipeline Failed! ==='
        }
    }
}
