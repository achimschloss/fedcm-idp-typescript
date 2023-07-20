#!/bin/bash

# Make sure to replace this with your own domains if not running on localhost
# Make sure to provide the necessary certificates in the filesystem as described in README.md
export DOMAIN_1="idp.example1.com"
export DOMAIN_2="idp.example2.com"

node  dist/bin/www.js