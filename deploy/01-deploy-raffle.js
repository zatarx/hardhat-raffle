const {networkConfig, developmentChains} = require("../helper-hardhat-config");
const {network, ethers} = require("hardhat");
const {verify} = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30");


module.exports = async function ({getNamedAccounts, deployments}) {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let vrfCoordinatorAddress, subscriptionId;
    if (developmentChains.includes(network.name)) {
        // const VRFCoordinatorV2_5Mock = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
        const vrfCoordinator = await ethers.getContract("VRFCoordinatorV2_5Mock");
        // const vrfCoordinatorV2_5Mock = VRFCoordinatorV2_5Mock.attach(
        vrfCoordinatorAddress = vrfCoordinator.target;
        // get subscriptionId for the mocked vrfCoordinator
        const transactionResponse = await vrfCoordinator.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);

        // SubscriptionCreated is being logged
        subscriptionId = transactionReceipt.logs[0].args.subId;
        await vrfCoordinator.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorAddress = networkConfig[network.config.chainId]["vrfCoordinatorAddress"];
        subscriptionId = networkConfig[network.config.chainId]["automationSubId"];
    }

    const entrenceFee = networkConfig[network.config.chainId]["entrenceFee"];
    const gasLane = networkConfig[network.config.chainId]["gasLane"];
    const interval = networkConfig[network.config.chainId]["interval"];
    const minExecutionBalance = networkConfig[network.config.chainId]["minExecutionBalance"];

    const raffleArgs = [vrfCoordinatorAddress, entrenceFee, minExecutionBalance, gasLane, subscriptionId, interval]; 

    log("Deploying Raffle contract...");
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: raffleArgs, 
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    });
    log("Raffle deployed");

    // Allow vrf mock to accept calls from raffle contract
    if (developmentChains.includes(network.name)) {
        const vrfCoordinator = await ethers.getContract("VRFCoordinatorV2_5Mock");
        await vrfCoordinator.addConsumer(subscriptionId, raffle.address);
        log("Added (subId, address) consumer to VRFCoordinatorV2_5Mock");
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying");
        await verify(raffle.address, raffleArgs);
        log("Contract verified");
    }
    
    log("------------------------");
}

module.exports.tags = ["all"];
