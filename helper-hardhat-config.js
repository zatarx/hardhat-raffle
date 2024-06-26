require("dotenv").config();

const { ethers } = require("hardhat");

const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorAddress: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
        entrenceFee: ethers.parseEther("0.001"),
        minExecutionBalance: ethers.parseEther("0.001"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // aka keyHash on Chainlink
        vrfSubId: process.env.VRF_SUBSCRIPTION_ID,
        interval: "30"
    },
    31137: {
        name: "hardhat",
        entrenceFee: ethers.parseEther("0.05"),
        minExecutionBalance: ethers.parseEther("0.1"),
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
        interval: "30",
    }
}

const developmentChains = ["hardhat", "localhost"];

module.exports = {
    networkConfig,
    developmentChains
}