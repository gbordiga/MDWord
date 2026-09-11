import { spawnSync } from "node:child_process";

const port = Number(process.argv[2] ?? 3000);

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8", windowsHide: true });
}

function listeningPids() {
  if (process.platform === "win32") {
    const { stdout } = run("netstat", ["-ano", "-p", "tcp"]);
    const pids = new Set();
    for (const line of String(stdout ?? "").split(/\r?\n/)) {
      const match = line.match(new RegExp(`TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "i"));
      if (match) pids.add(Number(match[1]));
    }
    return [...pids];
  }
  const { stdout, status } = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  if (status !== 0) return [];
  return String(stdout ?? "")
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function stop(pid) {
  if (pid === process.pid || pid === process.ppid) return;
  if (process.platform === "win32") {
    run("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  run("kill", ["-9", String(pid)]);
}

for (const pid of listeningPids()) {
  console.log(`Freeing port ${port} (pid ${pid})`);
  stop(pid);
}
