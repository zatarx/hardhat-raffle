## Raffle Lottery

Personally implemented Raffle inspired by Patrick's lottery implementation with a few tweaks:
1. Chainlink VRF: V2.5 (instead of V2) coordinators were integrated.
2. Chainlink Automation: native cannotExecute modifier used on checkUpkeep() in order to prevent onchain calls (eth_call only)


Extra Credit: 
[Patrick Collins](https://github.com/PatrickAlphaC)
