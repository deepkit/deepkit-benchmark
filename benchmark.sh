#!/bin/sh

#export AUTH_TOKEN=PLEASE_SET
export SEND_TO=https://deepkit.io/benchmark/add
export GIT_COMMIT=master

# if deepkit-framework does not exist, clone it
if [ ! -d "deepkit-framework" ]; then
  git clone https://github.com/deepkit/deepkit-framework.git
fi

cd deepkit-framework;
git fetch;
git checkout $GIT_COMMIT;
npm ci;
./node_modules/.bin/tsc --build tsconfig.json;
cd ../;


docker rm -f bench-mongo
#docker run -d --rm --name bench-mongo -p 127.0.0.1:27017:27017 mongo:4.2
# prisma needs transactions
docker run -d --rm --name bench-mongo -p 127.0.0.1:27017:27017 mongo:4.2 mongod --replSet rs0
docker exec -it bench-mongo mongo --eval 'rs.initiate({   _id: "rs0",   members: [     { _id: 0, host: "localhost:27017" }   ] })'

# we need to create the collection manually for prisma
docker exec -it bench-mongo mongo prisma --eval 'db.Model.insert({ name: "John Doe", age: 30 });'

docker rm -f bench-mysql
docker run -d --rm --name bench-mysql -d -e MYSQL_DATABASE=default -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -p 127.0.0.1:3306:3306 mysql:8

docker rm -f bench-postgres
docker run -d --rm --name bench-postgres -d -e POSTGRES_PASSWORD=password -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:5432:5432 postgres:13.4

node_modules/.bin/prisma generate --schema src/orm/end-to-end/mongo/model.prisma

nice -20 npm run benchmark rpc/grpc rpc/rpc-tcp-server orm/end-to-end/ bson/parse bson/serializer type/serialization/small type/validation
