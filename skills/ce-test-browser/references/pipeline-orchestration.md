# Pipeline-Mode Server Orchestration

Read and follow this file only when invoked with `mode:pipeline` (LFG or another automated runner). It overrides three things in the main workflow: the headed/headless question, free-port selection, and dev-server startup. In pipeline mode you run unattended — never block on a question.

## 1. No headed/headless question

Default to headless. Do not ask. Skip the "Choose Headed or Headless" step entirely and never pass `--headed`.

## 2. Claim a genuinely free port

Multiple agents may run on the same machine, so never assume the preferred port is free. Start from the preferred port computed by the port-determination step (`$PORT`) and scan upward to the first free port:

```bash
find_free_port() {
  local p=$1
  while lsof -i ":$p" -sTCP:LISTEN -t >/dev/null 2>&1; do
    p=$((p + 1))
  done
  echo "$p"
}
PORT=$(find_free_port "$PORT")
echo "Using dev server port: $PORT"
```

## 3. Auto-start the dev server if nothing is listening

In manual mode the skill stops and asks the user to start the server. In pipeline mode, start it in the background instead, picking the command that matches the project, then wait up to 30s for it to listen:

```bash
if lsof -i ":${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Server already running on port ${PORT}"
else
  echo "Starting dev server on port ${PORT}..."
  if [ -f "bin/dev" ]; then
    PORT=${PORT} bin/dev > /tmp/dev-server-${PORT}.log 2>&1 &
  elif [ -f "bin/rails" ]; then
    bin/rails server -p ${PORT} > /tmp/dev-server-${PORT}.log 2>&1 &
  elif [ -f "package.json" ]; then
    PORT=${PORT} npm run dev > /tmp/dev-server-${PORT}.log 2>&1 &
  fi
  for i in $(seq 1 30); do
    lsof -i ":${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1 && break
    sleep 1
  done
  if ! lsof -i ":${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Server did not start in 30s. Last output:"
    tail -20 /tmp/dev-server-${PORT}.log 2>/dev/null
    exit 1
  fi
fi
```

Once a server is confirmed listening on `$PORT`, return to the main workflow at the "Test Each Affected Page" step (open `http://localhost:${PORT}`, snapshot, then test each route).
