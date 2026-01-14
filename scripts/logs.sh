#!/bin/bash

# Log viewer script

SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    docker-compose logs -f --tail=100
else
    docker-compose logs -f --tail=100 $SERVICE
fi
