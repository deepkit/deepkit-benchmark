import { Broker, BrokerCacheKey, BrokerDeepkitAdapter, BrokerKernel } from "@deepkit/broker";
import { RpcTcpClientAdapter, RpcTcpServer } from "@deepkit/rpc-tcp";
import { BenchSuite } from "../bench";

class Model {
    ready?: boolean;

    tags: string[] = [];

    priority: number = 0;
    created: Date = new Date;

    constructor(
        public id: number,
        public name: string
    ) {
    }
}

export async function main() {
    const server = new RpcTcpServer(new BrokerKernel(), 'localhost:55552');
    server.start();

    const tcpAdapter = new RpcTcpClientAdapter('localhost:55552');
    const client = new Broker(new BrokerDeepkitAdapter({ servers: [{ url: '', transport: tcpAdapter }] }));

    const plain = {
        name: 'name',
        id: 2,
        tags: ['a', 'b', 'c'],
        priority: 5,
        created: new Date,
        ready: true,
    };

    type MyCache = BrokerCacheKey<Model, 'cache'>;
    client.provideCache<MyCache>(() => {
        return {} as any;
    });
    const key = client.cache<MyCache>();

    const suite = new BenchSuite('tcp-broker', 3);
    suite.addAsync('set', async () => {
        await key.set({}, plain);
    });

    suite.addAsync('get', async () => {
        await key.get({});
    });

    // suite.addAsync('increase', async () => {
    //     await client.increment('i');
    // });

    await suite.runAsync();

    client.disconnect();
    server.close();
}
