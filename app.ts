import { spawnSync } from "child_process";

function exec(command: string, cwd: string = __dirname) {
    spawnSync(command, { cwd: cwd, stdio: 'inherit', shell: true });
}

function checkout(sha: string) {
    console.log(`Checking out ${sha}`)
    exec(`git fetch`, 'deepkit-framework');
    exec(`git checkout ${sha}`, 'deepkit-framework');
    exec(`npm ci`, 'deepkit-framework');
    exec(`./node_modules/.bin/tsc --build tsconfig.json`, 'deepkit-framework');
}
