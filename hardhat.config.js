require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31137,
      blockConfirmations: 1,
      allowUnlimitedContractSize: true // to allow VRFCoordinatorV2_5Mock to be deployed
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL,
      // url: "https://eth-sepolia.api.onfinality.io/public",
      accounts: [`${process.env.WALLET_PRIVATE_KEY}`],
      blockConfirmations: 6
    }
  },
  gasReporter: {
    enabled: false,
    outputFile: "gasReporter.txt",
    noColors: true,
    currency: "USD",
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "MATIC" // to check how much it's going to cost to deploy the contract to polygon
  },
  solidity: "0.8.19",
  namedAccounts: {
    deployer: {
      default: 0
    },
    player: {
      default: 1
    }
  }
};
