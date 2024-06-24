const {getNamedAccounts, ethers, network} = require("hardhat");
const {developmentChains, networkConfig} = require("../../helper-hardhat-config");
const {HardhatEthersSigner} = require("@nomicfoundation/hardhat-ethers/signers");
const {HardhatEthersProvider} = require("@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider");
const {assert, expect} = require("chai");

!developmentChains.includes(network.name) ? describe.skip : describe("Raffle", async function () {
    let raffle, vrfCoordinatorMock, raffleEntrenceFee, deployer, interval;
    const chainId = network.config.chainId;

    beforeEach(async function() {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all", "mocks"]);
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer);
        raffleEntrenceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
    });

    describe("constructor", async function () {
        it("itinializes the raffle correctly", async function () {
            const raffleState = await raffle.getRaffleState();
            const interval = await raffle.getInterval();
            const minExecutionBalance = await raffle.getMinExecutionBalance();

            assert.equal(raffleState.toString(), "0");
            assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            assert.equal(minExecutionBalance.toString(), networkConfig[chainId]["minExecutionBalance"]);
        });
    });

    describe("enterRaffle", async function () {

        it("revert with error when user doesn't transfer enough", async function () {
            await expect(raffle.enterRaffle(
                {value: ethers.parseEther("0.000001")}
            )).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughEthEntered");
        });

        it("records players when they enter raffle", async function () {
            await raffle.enterRaffle({value: raffleEntrenceFee});
            const playerFromContract = await raffle.getPlayer(0);
            assert.equal(playerFromContract, deployer);
        });

        it("emits event on enter", async function () {
            await expect(raffle.enterRaffle({value: raffleEntrenceFee})).to.emit(raffle, "RaffleEnter").withArgs(deployer); 
        });

        it("does not allow entrence when performUpkeep is not called by a forwareder", async function () {
            await raffle.enterRaffle({value: raffleEntrenceFee});
            await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "OnlyForwarder");
        });
    });

    describe("checkUpkeep", async function () {
        it("revert with error when checkUpkeep is called onchain", async function () {
            await expect(raffle.checkUpkeep("0x")).to.be.revertedWithCustomError(raffle, "OnlySimulatedBackend");
        });

        it("returns false if current balance is less than min execution balance", async function () {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])
            const [,playerAddress] = await ethers.getSigners();

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.01")});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);
            
            // Zero address signer is a must to be able to staticCall with tx_overrivdes (aka eth_call)
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(!upkeepNeeded);
        });

        it("returns false if not enough time has passed", async function () {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])
            const [,playerAddress] = await ethers.getSigners();

            await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
            await network.provider.send("evm_mine", []);

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});
            
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(!upkeepNeeded);
        });

        it("returns false if raffle state is not open", async function () {
            const tx_overrides = {from: ethers.ZeroAddress};

            // Create zero address signer for making static_call to pass the cannotExecute modifier
            const zeroAddressProvider = new HardhatEthersProvider(raffle.runner.provider, network.name);
            const zeroAddressSigner = await HardhatEthersSigner.create(zeroAddressProvider, tx_overrides["from"]);
            const zeroAddressRaffle = await ethers.getContractAt("Raffle", raffle.target, zeroAddressSigner);

            const [,playerAddress,,forwarderAddress] = await ethers.getSigners();

            await zeroAddressRaffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});  

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);

            await raffle.setForwarderAddress(forwarderAddress);
            await raffle.connect(forwarderAddress).performUpkeep("0x"); 
 
            const {upkeepNeeded} = await zeroAddressRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            const raffleState = await raffle.getRaffleState();
            assert(raffleState, "Shouldn't be equal to 0 which corresponds to OPEN in RaffleState");
            assert(!upkeepNeeded);
        });

        it(`checkUpkeep is successful when interval has passed,
                someone entered raffle, balance is greater than min execution balance`, async function () {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])
            const [,playerAddress] = await ethers.getSigners();

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);
            
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(upkeepNeeded);
        });
    })


})  