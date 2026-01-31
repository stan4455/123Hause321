import "node:process";

const port = Number(process.env.PORT ?? 3000);

console.log(`App started (demo). PORT=${port}`);

