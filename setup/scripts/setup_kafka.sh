#/bin/bash

PROJECT_ROOT="$PWD/../../"

export TOPICS_FILE="$PROJECT_ROOT/setup/apps/video/kafka/topics.json"

docker network create vs-net

(cd ../setup/zookeeper/ \
    && docker-compose up -d)

(cd ../setup/kafka/ \
    && docker-compose --env-file $PROJECT_ROOT/.env up -d)

# TODO: Find alternative.
sleep 10

(cd ../setup/apps/ \
    && docker-compose up kafkainit)

