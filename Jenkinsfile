pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  environment {
    APP_NAME = 'travel-photos-app'
    NODE_ENV = 'test'
  }

  // Cross-platform command helpers (Linux/macOS via sh, Windows via bat).
  // Keep output stable across agents and avoid failing when tools are missing.
  // (Jenkins declarative doesn't allow function defs at top-level in all configs,
  // so we define them inside the first script block and reuse via closures.)

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      steps {
        script {
          def run = { String cmd ->
            if (isUnix()) {
              sh cmd
            } else {
              // bat returns exit code; make it fail on non-zero by default
              bat cmd
            }
          }

          def runAllowFail = { String cmd ->
            if (isUnix()) {
              sh "${cmd} || true"
            } else {
              // "|| exit /b 0" forces success regardless of prior failure
              bat "${cmd} || exit /b 0"
            }
          }

          // If you configure the Jenkins "NodeJS" tool, you can wrap this stage with:
          // nodejs(nodeJSInstallationName: 'node-20') { ... }
          runAllowFail('node -v')
          runAllowFail('npm -v')

          // Prefer npm ci when lockfile exists.
          if (fileExists('package-lock.json')) {
            run('npm ci')
          } else {
            run('npm install')
          }

          // Store helpers for later stages.
          env._RUN_HELPER_DEFINED = '1'
        }
      }
    }

    stage('Lint') {
      steps {
        script {
          def run = { String cmd -> if (isUnix()) { sh cmd } else { bat cmd } }
          run('npm run lint')
        }
      }
    }

    stage('Test') {
      steps {
        script {
          def run = { String cmd -> if (isUnix()) { sh cmd } else { bat cmd } }
          run('npm test')
        }
      }
    }

    stage('Docker build') {
      when {
        expression { return fileExists('Dockerfile') }
      }
      steps {
        script {
          def run = { String cmd -> if (isUnix()) { sh cmd } else { bat cmd } }
          def getStdout = { String cmd ->
            if (isUnix()) {
              return sh(script: cmd, returnStdout: true).trim()
            }
            // bat doesn't support returnStdout reliably across Jenkins versions;
            // use a temp file to capture output.
            def outFile = '.jenkins_cmd_out.txt'
            bat "@echo off\r\n${cmd} > ${outFile}\r\n"
            def output = readFile(outFile).trim()
            return output
          }

          // Skip Docker stages if docker isn't available on the agent.
          def dockerOk = true
          try {
            run(isUnix() ? 'docker version' : 'docker version')
          } catch (ignored) {
            dockerOk = false
            echo 'Docker not available on this agent; skipping Docker build.'
          }
          if (!dockerOk) {
            return
          }

          def shortSha = getStdout('git rev-parse --short HEAD')
          def imageTag = "${env.APP_NAME}:${shortSha}"
          env.BUILT_IMAGE = imageTag
          run("docker build -t ${imageTag} .")
        }
      }
    }

    stage('Docker push (optional)') {
      when {
        allOf {
          expression { return env.DOCKER_REGISTRY?.trim() }
          expression { return env.DOCKER_REPO?.trim() }
          expression { return env.BUILT_IMAGE?.trim() }
        }
      }
      steps {
        script {
          // Set these as Jenkins environment variables:
          // - DOCKER_REGISTRY (e.g. ghcr.io)
          // - DOCKER_REPO (e.g. gaowmw/travel-photos-app)
          // And create a Jenkins Username/Password credential:
          // - ID: docker-registry
          // - username: registry username
          // - password: registry token/password
          def run = { String cmd -> if (isUnix()) { sh cmd } else { bat cmd } }
          def getStdout = { String cmd ->
            if (isUnix()) {
              return sh(script: cmd, returnStdout: true).trim()
            }
            def outFile = '.jenkins_cmd_out.txt'
            bat "@echo off\r\n${cmd} > ${outFile}\r\n"
            return readFile(outFile).trim()
          }

          // Skip push if Docker isn't available.
          def dockerOk = true
          try {
            run(isUnix() ? 'docker version' : 'docker version')
          } catch (ignored) {
            dockerOk = false
            echo 'Docker not available on this agent; skipping Docker push.'
          }
          if (!dockerOk) {
            return
          }

          def shortSha = getStdout('git rev-parse --short HEAD')
          def fullTag = "${env.DOCKER_REGISTRY}/${env.DOCKER_REPO}:${shortSha}"

          withCredentials([usernamePassword(credentialsId: 'docker-registry', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
            if (isUnix()) {
              sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin "$DOCKER_REGISTRY"'
            } else {
              // Windows: docker login supports --password-stdin in recent versions;
              // fall back to -p if needed by your environment.
              bat '@echo off\r\necho %DOCKER_PASS% | docker login -u "%DOCKER_USER%" --password-stdin "%DOCKER_REGISTRY%"\r\n'
            }
            run("docker tag ${env.BUILT_IMAGE} ${fullTag}")
            run("docker push ${fullTag}")
          }

          // Expose the fully-qualified image tag for later deploy stages.
          env.DEPLOY_IMAGE = fullTag
        }
      }
    }

    stage('Deploy to Kubernetes (optional)') {
      when {
        allOf {
          expression { return env.DEPLOY_TO_K8S == 'true' }
          expression { return env.DEPLOY_IMAGE?.trim() }
        }
      }
      steps {
        script {
          // Requirements on the Jenkins agent:
          // - kubectl installed and on PATH
          // - KUBECONFIG environment variable points at a valid kubeconfig
          // Recommended additional env vars in the job:
          // - K8S_NAMESPACE (e.g. "default")
          // - K8S_DEPLOYMENT (e.g. "travel-photos-app")

          def run = { String cmd -> if (isUnix()) { sh cmd } else { bat cmd } }

          // Basic safety checks.
          try {
            run('kubectl version --client')
          } catch (ignored) {
            echo 'kubectl not available on this agent; skipping Kubernetes deploy.'
            return
          }

          def ns = env.K8S_NAMESPACE ?: 'default'
          def deployment = env.K8S_DEPLOYMENT ?: env.APP_NAME

          echo "Deploying image ${env.DEPLOY_IMAGE} to Kubernetes deployment ${deployment} in namespace ${ns}"

          // Apply manifests (expects k8s/deployment.yaml and k8s/service.yaml in repo).
          if (fileExists('k8s')) {
            run("kubectl apply -n ${ns} -f k8s")
          }

          // Ensure the deployment uses the freshly built image.
          run("kubectl set image deployment/${deployment} ${env.APP_NAME}=${env.DEPLOY_IMAGE} -n ${ns}")
          run("kubectl rollout status deployment/${deployment} -n ${ns}")
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'Dockerfile, Jenkinsfile, package.json, server.js, public/**, views/**', fingerprint: true
    }
  }
}

