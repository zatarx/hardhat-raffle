const {getNamedAccounts, ethers, network} = require("hardhat");
const {developmentChains, networkConfig} = require("../../helper-hardhat-config");
const {HardhatEthersSigner} = require("@nomicfoundation/hardhat-ethers/signers");
const {HardhatEthersProvider} = require("@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider");
const {assert, expect} = require("chai");

!developmentChains.includes(network.name) ? describe.skip : describe("Raffle", async () => {
    let raffle, raffleProvider, vrfCoordinatorMock,
        raffleEntrenceFee, deployer, interval, playerAddress, forwarderAddress;
    const chainId = network.config.chainId;

    beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all", "mocks"]);
        raffle = await ethers.getContract("Raffle", deployer);
        raffleProvider = raffle.runner.provider;
        vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer);
        raffleEntrenceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
        [,playerAddress,forwarderAddress] = await ethers.getSigners(); 
    });

    describe("constructor", async () => {
        it("itinializes the raffle correctly", async () => {
            const raffleState = await raffle.getRaffleState();
            const interval = await raffle.getInterval();
            const minExecutionBalance = await raffle.getMinExecutionBalance();

            assert.equal(raffleState.toString(), "0");
            assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            assert.equal(minExecutionBalance.toString(), networkConfig[chainId]["minExecutionBalance"]);
        });
    });

    describe("enterRaffle", async () => {

        it("revert with error when user doesn't transfer enough", async () => {
            await expect(raffle.enterRaffle(
                {value: ethers.parseEther("0.000001")}
            )).to.be.revertedWithCustomError(raffle, "Raffle__NotEnoughEthEntered");
        });

        it("records players when they enter raffle", async () => {
            await raffle.enterRaffle({value: raffleEntrenceFee});
            const playerFromContract = await raffle.getPlayer(0);
            assert.equal(playerFromContract, deployer);
        });

        it("emits event on enter", async () => {
            await expect(raffle.enterRaffle({value: raffleEntrenceFee})).to.emit(raffle, "RaffleEnter").withArgs(deployer); 
        });

        it("does not allow entrence when performUpkeep is not called by a forwareder", async () => {
            await raffle.enterRaffle({value: raffleEntrenceFee});
            await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "OnlyForwarder");
        });
    });

    describe("checkUpkeep", async () => {
        it("revert with error when checkUpkeep is called onchain", async () => {
            await expect(raffle.checkUpkeep("0x")).to.be.revertedWithCustomError(raffle, "OnlySimulatedBackend");
        });

        it("returns false if current balance is less than min execution balance", async () => {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: raffleEntrenceFee});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);
            
            // Zero address signer is a must to be able to staticCall with tx_overrivdes (aka eth_call)
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(!upkeepNeeded);
        });

        it("returns false if not enough time has passed", async () => {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])

            await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
            await network.provider.send("evm_mine", []);

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: raffleEntrenceFee});
            
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(!upkeepNeeded);
        });

        it("returns false if raffle state is not open", async () => {
            const tx_overrides = {from: ethers.ZeroAddress};

            // Create zero address signer for making static_call to pass the cannotExecute modifier
            const zeroAddressProvider = new HardhatEthersProvider(raffle.runner.provider, network.name);
            const zeroAddressSigner = await HardhatEthersSigner.create(zeroAddressProvider, tx_overrides["from"]);
            const zeroAddressRaffle = await ethers.getContractAt("Raffle", raffle.target, zeroAddressSigner);

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
                someone entered raffle, balance is greater than min execution balance`, async () => {
            const tx_overrides = {from: ethers.ZeroAddress};
            const zeroSignerRaffle = await ethers.getContract("Raffle", tx_overrides["from"])

            await zeroSignerRaffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);
            
            const {upkeepNeeded} = await zeroSignerRaffle.checkUpkeep.staticCall("0x", tx_overrides);
            assert(upkeepNeeded);
        });
    });

    describe("performUpkeep", async () => {
        it("revert if not called by a forwarder", async () => {
            await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "OnlyForwarder");
        });

        it("successfully called when balled by a forwarder", async () => {
            await raffle.setForwarderAddress(forwarderAddress);
            await raffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []); 

            const txResponse = await raffle.connect(forwarderAddress).performUpkeep("0x");
            const txReceipt = await txResponse.wait(network.config.blockConfirmations);

            const txLogs = txReceipt.logs.map((_log) => _log.eventName);
            const raffleState = await raffle.getRaffleState();
            assert(txLogs.includes("RequestedRaffleWinner"));
            assert.notEqual(raffleState.toString(), "0");
            
        });
    });

    describe("fulfillRandomWords", async () => {
        beforeEach(async () => {
            await raffle.setForwarderAddress(forwarderAddress);
            await raffle.connect(playerAddress).enterRaffle({value: ethers.parseEther("0.15")});

            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []); 
        });

        it("can only be called after performUpkeep", async () => {
            await expect(vrfCoordinatorMock.fulfillRandomWords(0, raffle.target)).to.be.revertedWithCustomError(
                vrfCoordinatorMock, "InvalidRequest"
            );
            await expect(vrfCoordinatorMock.fulfillRandomWords(1, raffle.target)).to.be.revertedWithCustomError(
                vrfCoordinatorMock, "InvalidRequest"
            );
        })

        it("call fulfillRandomWords emulating Chainlink contract call", async () => {
            const startingIndex = 5; // [owner, x, x, forwarderAddress, ...
            const usersAmount = 15;
            const accounts = await ethers.getSigners();
            let winnerStartingBalance;

            for (
                let i = startingIndex;
                i < startingIndex + usersAmount;
                i++
            ) {
                await raffle.connect(accounts[i]).enterRaffle({value: ethers.parseEther("0.1")});
            }

            const startingTimestamp = await raffle.getLastUpkeepTimestamp();

            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    console.log("WinnerPicked is found, listener has been triggered");
                    try {
                        const recentWinner = await raffle.getRecentWinner();
                        const recentWinnerBalance = await raffleProvider.getBalance(recentWinner);
                        const raffleState = await raffle.getRaffleState();
                        const endingTimeStamp = await raffle.getLastUpkeepTimestamp();
                        const numPlayers = await raffle.getNumberOfPlayers();

                        assert.equal(numPlayers.toString(), "0");
                        assert.equal(raffleState.toString(), "0");
                        assert(endingTimeStamp > startingTimestamp);

                         // 15 users total, 1 donates 0.15eth, 15 others - 0.1eth
                        assert.equal(ethers.formatEther(recentWinnerBalance - winnerStartingBalance), "1.65"); 
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });

                try {
                    const txResponse = await raffle.connect(forwarderAddress).performUpkeep("0x");
                    const txReceipt = await txResponse.wait(network.blockConfirmations);

                    winnerStartingBalance = await raffleProvider.getBalance(accounts[17].address);
                    console.log("executing performUpkeep..");
                    await vrfCoordinatorMock.fulfillRandomWords(
                        txReceipt.logs[1].args.requestId, raffle.target
                    );
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
});