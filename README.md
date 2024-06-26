## Raffle Lottery

Self-written and tested Raffle contract inspired by Patrick's lottery implementation with a few tweaks:
1. Chainlink VRF: V2.5 (instead of V2) coordinators were integrated.
2. Chainlink Automation: cannotExecute modifier was initially used on checkUpkeep() 
in order to prevent onchain execution (eth_call only). Later turned out that Chainlink doesn't
submit zero address as <b>from</b> for their txs, so cannotExecute had to be removed.

**Interaction Rules (UI to be implemented)**

Users can *enterRaffle*(in RemixIDE only for now) donating min 0.001 eth, and wait till the winner gets picked & payed. Payouts are done every 30 seconds.

Sepolia: https://sepolia.etherscan.io/address/0x1658029Ce0e48d70865d7c4230460d8e3a8E296e
See events for more detail.


Extra Credit: 
[Patrick Collins](https://github.com/PatrickAlphaC)
