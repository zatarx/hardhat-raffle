require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
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
