#!/bin/bash

# This defaults to our own test domains currently
# TODO
export DOMAIN_1=${DOMAIN_1:-"idp-a-test.de"}
export DOMAIN_2=${DOMAIN_2:-"idp-b-test.de"}

node  dist/bin/www.js