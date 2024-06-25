
const {network, ethers} = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");


// Test values that don't impact the test workflow
const BASE_FEE = ethers.parseEther("0.0025");
const GAS_PRICE_ARG = 1e9; // Setting a value at my own discretion
const WEI_PER_UNIT_LINK = ethers.parseEther("0.0042");

module.exports = async function ({getNamedAccounts, deployments}) {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        // deploy a mock vrf coordinator)
        await deploy("VRFCoordinatorV2_5Mock", {
            contract: "VRFCoordinatorV2_5Mock",
            from: deployer,
            log: true,
            args: [BASE_FEE.toString(), GAS_PRICE_ARG.toString(), WEI_PER_UNIT_LINK.toString()]
        });
        log("Mocks deployed");
        log("-----------------------");
    }
}

module.exports.tags = ["all", "mocks"];