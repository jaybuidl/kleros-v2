#!/bin/bash

curl -s https://chainid.network/chains.json | jq '.[] | select(.name as $n | [
    "Ethereum Mainnet", 
    "Arbitrum One", 
    "Rinkeby", 
    "Arbitrum Rinkeby", 
    "Gnosis Chain (formerly xDai)", 
    "POA Network Sokol"
] | index($n))'
