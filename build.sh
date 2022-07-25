#!/bin/bash
docker build -t matisiekpl/payouts:v20 --platform linux/amd64 .
docker push matisiekpl/payouts:v20
