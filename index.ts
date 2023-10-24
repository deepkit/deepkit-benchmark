import { mkdirSync, readdirSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as vm from 'vm';
import * as si from 'systeminformation';
import { execSync } from 'child_process';
import { serialize } from '@deepkit/type';
import fetch from 'node-fetch';
import { BenchmarkRun } from "./model";
import fg from 'fast-glob';

export async function run(benchmarks: string[]): Promise<void> {
    const filters = benchmarks
        .map(v => v.startsWith('src/') ? v.substr(4) : v)
        .map(v => v.lastIndexOf('.bench.') ? v.slice(0, v.lastIndexOf('.bench.')) : v)
        .map(v => v.replace(/\*/, '.*'))
        .map(v => new RegExp(v));

    const sendResultsTo = process.env.SEND_TO || '';

    if (filters.length) console.log('filter by', filters);

    //create for all folders: ln -s ../../../deepkit-framework/packages/* src/node_modules/@deepkit/*
    const frameworkDir = './deepkit-framework';
    const files = readdirSync(frameworkDir + '/packages');
    for (const file of files) {
        const t = './src/node_modules/@deepkit/' + file;
        try {
            unlinkSync(t);
        } catch {
        }
        symlinkSync('../../../' + frameworkDir + '/packages/' + file, t);
    }

    const totalResults: { [path: string]: any } = {};
    let glob = ['./src/**/*.bench.(ts|tsx)'];

    const benchmarkPaths = fg.sync(glob, { onlyFiles: true, unique: true });

    for (const benchmarkPath of benchmarkPaths) {
        const id = benchmarkPath.substring('./src/'.length, benchmarkPath.lastIndexOf('.bench.'));

        if (filters.length) {
            let found = false;
            for (const filter of filters) {
                if (filter.exec(id)) {
                    found = true;
                    break;
                }
            }
            if (!found) continue;
        }

        console.log('🏃‍run', id);

        const onComplete = (name: string, result: { [name: string]: { hz: number, elapsed: number, rme: number, mean: number } }) => {
            totalResults[id] = result;
        };

        for (const key in require.cache) {
            delete require.cache[key];
        }
        try {
            const script = new vm.Script(`require('./src/bench').BenchSuite.onComplete = onComplete; (require(benchmarkPath).main())`);
            await script.runInNewContext({ benchmarkPath, require, onComplete });
        } catch (error) {
            console.log('Benchmark errored', error);
        }
    }

    const resultsPath = join(__dirname, 'results');
    mkdirSync(resultsPath, { recursive: true });
    const jsonPath = resultsPath + '/' + (new Date().toJSON()) + '.json';
    console.log('Write benchmark result to', jsonPath);
    writeFileSync(jsonPath, JSON.stringify(totalResults, undefined, 4));

    if (sendResultsTo) {
        console.log('Send to', sendResultsTo);

        const benchmarkRun = new BenchmarkRun;
        benchmarkRun.data = totalResults;
        const cpu = await si.cpu();
        const mem = await si.mem();
        benchmarkRun.cpuName = cpu.manufacturer + ' ' + cpu.brand;
        benchmarkRun.cpuClock = cpu.speed;
        benchmarkRun.cpuCores = cpu.cores;
        benchmarkRun.memoryTotal = mem.total;

        const os = await si.osInfo();
        benchmarkRun.os = `${os.platform} ${os.distro} ${os.release} ${os.kernel} ${os.arch}`;
        benchmarkRun.commit = execSync('git rev-parse HEAD', {cwd: './deepkit-framework'}).toString('utf8').trim();

        await fetch(sendResultsTo, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(serialize<{ auth: string, run: BenchmarkRun }>({ auth: process.env.AUTH_TOKEN || 'notSet', run: benchmarkRun })),
        });
    }
}

run(process.argv.slice(2)).catch(e => {
    console.error(e);
    process.exit(0);
}).then(() => process.exit(0));
