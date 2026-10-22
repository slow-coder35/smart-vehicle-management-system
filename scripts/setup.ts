import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
if (!existsSync(".env.local")) {
  const pg = randomBytes(20).toString("hex"),
    app = randomBytes(20).toString("hex"),
    mongo = randomBytes(20).toString("hex"),
    mapp = randomBytes(20).toString("hex");
  const values = {
    DATABASE_URL: `postgresql://motive_app:${app}@127.0.0.1:54329/motive`,
    DATABASE_ADMIN_URL: `postgresql://postgres:${pg}@127.0.0.1:54329/motive`,
    MONGODB_URI: `mongodb://motive_app:${mapp}@127.0.0.1:27029/motive?authSource=motive`,
    MONGODB_ADMIN_URI: `mongodb://admin:${mongo}@127.0.0.1:27029/admin`,
    APP_ORIGIN: "http://localhost:3000",
    DEMO_PASSWORD: `Demo-${randomBytes(6).toString("hex")}!`,
  };
  writeFileSync(
    ".env.local",
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  Object.assign(process.env, values);
}
const pg = new URL(process.env.DATABASE_ADMIN_URL!),
  mongo = new URL(process.env.MONGODB_ADMIN_URI!);
const configs = [
  {
    name: "motive-postgres",
    image: "postgres:17-alpine",
    port: "54329:5432",
    volume: "/var/lib/postgresql/data",
    env: {
      POSTGRES_PASSWORD: decodeURIComponent(pg.password),
      POSTGRES_DB: "motive",
    },
  },
  {
    name: "motive-mongo",
    image: "mongo:8.0",
    port: "27029:27017",
    volume: "/data/db",
    env: {
      MONGO_INITDB_ROOT_USERNAME: "admin",
      MONGO_INITDB_ROOT_PASSWORD: decodeURIComponent(mongo.password),
    },
  },
];
for (const c of configs) {
  const found =
    spawnSync("docker", ["inspect", c.name], { stdio: "ignore" }).status === 0;
  console.log(`${found ? "Starting" : "Creating"} ${c.name}…`);
  if (found) execFileSync("docker", ["start", c.name], { stdio: "inherit" });
  else
    execFileSync(
      "docker",
      [
        "run",
        "-d",
        "--name",
        c.name,
        "--label",
        "app=motive",
        "-p",
        `127.0.0.1:${c.port}`,
        "-v",
        `${c.name}-data:${c.volume}`,
        ...Object.keys(c.env).flatMap((k) => ["-e", k]),
        c.image,
      ],
      { stdio: "inherit", env: { ...process.env, ...c.env } },
    );
}
for (const script of ["migrate", "seed"])
  execFileSync(
    process.execPath,
    ["--env-file=.env.local", "--import", "tsx", `scripts/${script}.ts`],
    { stdio: "inherit" },
  );
console.log(
  "Ready. Run npm run dev. Demo emails: customer@motive.test, staff@motive.test, admin@motive.test. The shared demo password is DEMO_PASSWORD in .env.local.",
);
